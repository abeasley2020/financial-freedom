import { useEffect, useState } from 'react';

export type Route = 'play' | 'table';

function read(): Route {
  return window.location.hash.startsWith('#/table') ? 'table' : 'play';
}

/** Hash routes, so the same static deploy serves the controller (#/) and the TV table (#/table). */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const onChange = () => {
      setRoute(read());
    };
    window.addEventListener('hashchange', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
    };
  }, []);
  return route;
}

export function tableUrl(): string {
  return `${window.location.origin}${window.location.pathname}#/table`;
}
