/** Nombre de fenêtres modales ouvertes (hors animation de fermeture). */
let openModals = 0;

export function modalOpened(): () => void {
  openModals += 1;
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    openModals -= 1;
  };
}

export function isModalOpen(): boolean {
  return openModals > 0;
}
