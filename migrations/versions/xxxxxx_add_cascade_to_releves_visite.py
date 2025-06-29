from alembic import op
import sqlalchemy as sa

revision = 'xxxxxx'  # Remplace par l'ID de ta migration
down_revision = '7181cce9151f'  # Met ici la dernière révision appliquée
branch_labels = None
depends_on = None

def upgrade():
    # Supprimer l'ancienne contrainte FK (nom à adapter selon ta base)
    op.drop_constraint('releves_visite_magasin_id_fkey', 'releves_visite', type_='foreignkey')

    # Ajouter nouvelle contrainte avec ON DELETE CASCADE
    op.create_foreign_key(
        'releves_visite_magasin_id_fkey',
        'releves_visite',
        'magasins',
        ['magasin_id'],
        ['id'],
        ondelete='CASCADE'
    )

def downgrade():
    # Revenir à l’ancienne contrainte sans cascade
    op.drop_constraint('releves_visite_magasin_id_fkey', 'releves_visite', type_='foreignkey')
    op.create_foreign_key(
        'releves_visite_magasin_id_fkey',
        'releves_visite',
        'magasins',
        ['magasin_id'],
        ['id']
        # Pas d’ondelete
    )
