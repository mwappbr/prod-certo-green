import { useListing } from './ListingProvider';

export function ItemPlaceholderPage({ id }: { id: number }) {
  const { backToListing } = useListing();

  return (
    <main className="listing item-placeholder" aria-labelledby="item-placeholder-title">
      <button className="listing__button item-placeholder__back" type="button" onClick={backToListing}>
        Voltar
      </button>
      <section className="item-placeholder__panel">
        <p className="listing__eyebrow">HN Moderno</p>
        <h1 id="item-placeholder-title">Detalhe da história</h1>
        <p>O conteúdo completo da história será disponibilizado em uma próxima etapa.</p>
        <p className="item-placeholder__id">Identificador: {id}</p>
      </section>
    </main>
  );
}
