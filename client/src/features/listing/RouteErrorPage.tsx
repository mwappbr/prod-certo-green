import { useListing } from './ListingProvider';

export function RouteErrorPage() {
  const { backToListing } = useListing();

  return (
    <main className="listing route-error" aria-labelledby="route-error-title">
      <section className="route-error__panel" role="alert">
        <p className="listing__eyebrow">HN Moderno</p>
        <h1 id="route-error-title">Página não encontrada</h1>
        <p>O endereço solicitado não corresponde a uma página disponível.</p>
        <button className="listing__button" type="button" onClick={backToListing}>
          Voltar à lista
        </button>
      </section>
    </main>
  );
}
