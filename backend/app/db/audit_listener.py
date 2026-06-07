import json
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID, uuid4
from sqlalchemy import event
from sqlalchemy.orm import Session, attributes

from app.core.audit_context import current_user_id, current_ip
from app.models.audit import AuditLog
from app.models.accounts import JournalEntry
from app.models.purchase import PurchaseEntry
from app.models.sales import Invoice
from app.models.finance import Payment, PaymentReceipt, VendorPayment

TRACKED_CLASSES = (JournalEntry, PurchaseEntry, Invoice, Payment, PaymentReceipt, VendorPayment)


def serialize_field(val):
    if val is None:
        return None
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, UUID):
        return str(val)
    if isinstance(val, Decimal):
        return str(val)
    if isinstance(val, (int, float, bool, str)):
        return val
    try:
        return str(val)
    except Exception:
        return None


def get_model_changes(instance, action):
    state = attributes.instance_state(instance)
    old_values = {}
    new_values = {}

    for attr in state.mapper.columns:
        col_name = attr.key
        history = attributes.get_history(instance, col_name)

        if action == "create":
            val = getattr(instance, col_name)
            if val is not None:
                new_values[col_name] = serialize_field(val)
        elif action == "modify":
            if history.has_changes():
                if history.deleted:
                    old_values[col_name] = serialize_field(history.deleted[0])
                else:
                    old_values[col_name] = None
                if history.added:
                    new_values[col_name] = serialize_field(history.added[0])
                else:
                    new_values[col_name] = None
        elif action == "delete":
            val = getattr(instance, col_name)
            if val is not None:
                old_values[col_name] = serialize_field(val)

    return old_values, new_values


@event.listens_for(Session, "before_flush")
def receive_before_flush(session, flush_context, instances):
    logs_to_add = []

    # Check new objects
    for obj in session.new:
        if isinstance(obj, TRACKED_CLASSES):
            old_v, new_v = get_model_changes(obj, "create")
            rec_id = obj.id
            if rec_id is None:
                rec_id = uuid4()
                obj.id = rec_id
            log = AuditLog(
                id=uuid4(),
                user_id=current_user_id.get(),
                timestamp=datetime.utcnow(),
                ip_address=current_ip.get(),
                action="create",
                table_name=obj.__tablename__,
                record_id=rec_id,
                old_values=old_v or None,
                new_values=new_v or None
            )
            logs_to_add.append(log)

    # Check dirty objects
    for obj in session.dirty:
        if isinstance(obj, TRACKED_CLASSES):
            state = attributes.instance_state(obj)
            has_actual_changes = False
            for attr in state.mapper.columns:
                history = attributes.get_history(obj, attr.key)
                if history.has_changes():
                    has_actual_changes = True
                    break

            if has_actual_changes:
                old_v, new_v = get_model_changes(obj, "modify")
                # Only log if we have non-empty changes
                if old_v or new_v:
                    log = AuditLog(
                        id=uuid4(),
                        user_id=current_user_id.get(),
                        timestamp=datetime.utcnow(),
                        ip_address=current_ip.get(),
                        action="modify",
                        table_name=obj.__tablename__,
                        record_id=obj.id,
                        old_values=old_v or None,
                        new_values=new_v or None
                    )
                    logs_to_add.append(log)

    # Check deleted objects
    for obj in session.deleted:
        if isinstance(obj, TRACKED_CLASSES):
            old_v, new_v = get_model_changes(obj, "delete")
            log = AuditLog(
                id=uuid4(),
                user_id=current_user_id.get(),
                timestamp=datetime.utcnow(),
                ip_address=current_ip.get(),
                action="delete",
                table_name=obj.__tablename__,
                record_id=obj.id,
                old_values=old_v or None,
                new_values=new_v or None
            )
            logs_to_add.append(log)

    # Add logs to session
    for log in logs_to_add:
        session.add(log)
