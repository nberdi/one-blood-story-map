import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const RouterContext = createContext(null);

function getLocationSnapshot() {
  return {
    pathname: window.location.pathname || "/",
    search: window.location.search || "",
    state: window.history.state || null,
  };
}

export function RouterProvider({ children }) {
  const [location, setLocation] = useState(getLocationSnapshot);

  useEffect(() => {
    const handlePopState = () => {
      setLocation(getLocationSnapshot());
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((to, options = {}) => {
    const { replace = false, state = null } = options;
    const method = replace ? "replaceState" : "pushState";
    window.history[method](state, "", to);
    setLocation(getLocationSnapshot());
  }, []);

  const value = useMemo(
    () => ({
      location,
      navigate,
    }),
    [location, navigate],
  );

  return (
    <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
  );
}

export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error("useRouter must be used within RouterProvider");
  }
  return context;
}

export function AppLink({ to, className, children, onClick, ...rest }) {
  const { navigate } = useRouter();

  const handleClick = (event) => {
    if (onClick) onClick(event);
    if (event.defaultPrevented) return;

    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0 ||
      rest.target === "_blank"
    ) {
      return;
    }

    event.preventDefault();
    navigate(to);
  };

  return (
    <a href={to} className={className} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
