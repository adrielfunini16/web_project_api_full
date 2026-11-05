export default function LoadingScreen() {
  return (
    <div className="loading-screen" role="status">
      <div className="loading-screen__spinner" aria-hidden="true" />
      <p className="loading-screen__text">Verificando sua sessão...</p>
    </div>
  );
}
