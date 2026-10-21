import { useRouter } from "expo-router";

// Back to the screen this one opens from; opened with nothing behind it (a deep link, a restart),
// it goes to `fallback` instead. Most stacked screens open from More.
export function useGoBack(fallback = "/more") {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : router.navigate(fallback));
}
