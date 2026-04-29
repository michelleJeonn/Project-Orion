const { useState: useStateApp, useEffect: useEffectApp } = React;

function useHashRoute(){
  const [hash, setHash] = useStateApp(window.location.hash || '#/');
  useEffectApp(() => {
    const h = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return hash;
}

function go(path){ window.location.hash = path; }

function App(){
  const hash = useHashRoute();
  const [query, setQuery] = useStateApp(localStorage.getItem('cryosis.query') || '');

  useEffectApp(() => {
    if(query) localStorage.setItem('cryosis.query', query);
  }, [query]);

  if(hash.startsWith('#/home')){
    return <Home onBack={() => go('#/')}
                 onSubmit={(q) => { setQuery(q); go('#/job'); }} />;
  }
  if(hash.startsWith('#/job')){
    return <Job query={query} onBack={() => go('#/home')}/>;
  }
  if(hash.startsWith('#/report')){
    const R = window.ReportPanel;
    return R
      ? <R query={query || window.__CRYOSIS_MOCK?.disease || "Parkinson's disease"}
           onBack={() => go('#/home')}
           MOCK={window.__CRYOSIS_MOCK || {disease:"Parkinson's disease"}}/>
      : <div style={{color:'#fff',padding:40}}>Loading Reportâ¦</div>;
  }
  return <Landing onEnter={() => go('#/home')}/>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
