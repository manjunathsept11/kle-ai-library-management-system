"""borrow requests (member asks, librarian approves)

Revision ID: 0004_borrow_requests
Revises: 0003_engagement
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_borrow_requests"
down_revision: str | None = "0003_engagement"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "borrow_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("book_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "approved", "rejected", "cancelled",
                    name="borrow_request_status", native_enum=False, length=30),
            nullable=False,
        ),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("decision_note", sa.Text(), nullable=True),
        sa.Column("decided_by", sa.Uuid(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("loan_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["decided_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["loan_id"], ["loans.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("borrow_requests", schema=None) as batch_op:
        batch_op.create_index("ix_borrow_requests_status", ["status"])
        batch_op.create_index("ix_borrow_requests_book_id", ["book_id"])
        batch_op.create_index("ix_borrow_requests_user_id", ["user_id"])


def downgrade() -> None:
    op.drop_table("borrow_requests")
