import { Link } from 'react-router';
import { TABLES } from '../../config/tables';
import { useGameStore } from '../../store/gameStore';
import { useProfileStore } from '../../store/profileStore';
import { TableTile } from '../lobby/TableTile';
import { Modal } from './Modal';

/** Sélection rapide de la table depuis la barre du haut. */
export function TableSelectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tableId = useGameStore((s) => s.engine.table.id);
  const changeTable = useGameStore((s) => s.changeTable);
  const level = useProfileStore((s) => s.level);
  const xp = useProfileStore((s) => s.xp);
  return (
    <Modal open={open} title="Choisir une table" onClose={onClose} size="lg">
      <div className="grid gap-3 sm:grid-cols-2">
        {TABLES.map((t) => (
          <TableTile
            key={t.id}
            table={t}
            level={level}
            xp={xp}
            current={t.id === tableId}
            compact
            onPlay={() => {
              if (changeTable(t.id)) onClose();
            }}
          />
        ))}
      </div>
      <Link
        to="/lobby"
        className="mt-4 inline-block text-sm text-accent-light underline-offset-4 hover:underline"
        onClick={onClose}
      >
        Ouvrir le lobby
      </Link>
    </Modal>
  );
}
