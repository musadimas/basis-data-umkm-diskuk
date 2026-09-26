import type {
  DehydratedState,
  VueQueryPluginOptions,
} from "@tanstack/vue-query";
import {
  VueQueryPlugin,
  QueryClient,
  QueryCache,
  MutationCache,
  hydrate,
  dehydrate,
} from "@tanstack/vue-query";
import { persistQueryClient } from "@tanstack/query-persist-client-core";
import { createQueryPersister, clearPrivateClientState } from "~/lib";
import { defineNuxtPlugin, useState } from "nuxt/app";
import { AUTH_ERROR_CODES } from "~/constants";

interface AuthErrorLike {
  status?: unknown;
  statusCode?: unknown;
  /** Directus SDK RequestError carries the HTTP response. */
  response?: { status?: unknown } | null;
  errors?: Array<{ extensions?: { code?: unknown } }>;
}

function isAuthErrorCode<T>(value: T): value is T & string {
  return typeof value === "string";
}

function isAuthError<E>(error: E): error is E & AuthErrorLike {
  if (!error || typeof error !== "object") return false;
  // SAFETY: the guard above established that the caught value is a non-null object; Directus auth failures expose these fields.
  const candidate = error as AuthErrorLike;
  const errorCode = candidate.errors?.[0]?.extensions?.code;
  return (
    candidate.response?.status === 401 ||
    candidate.status === 401 ||
    candidate.statusCode === 401 ||
    (isAuthErrorCode(errorCode) && AUTH_ERROR_CODES.has(errorCode))
  );
}

function onQueryError(error: Error) {
  if (import.meta.client && isAuthError(error)) {
    void clearPrivateClientState();
    window.dispatchEvent(new Event("auth:unauthorized"));
  }
}

export default defineNuxtPlugin((nuxt) => {
  const vueQueryState = useState<DehydratedState | null>("vue-query");
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: onQueryError }),
    mutationCache: new MutationCache({ onError: onQueryError }),
    defaultOptions: {
      queries: { staleTime: 5000, refetchOnWindowFocus: false, retry: false },
    },
  });
  const options: VueQueryPluginOptions = { queryClient };
  nuxt.vueApp.use(VueQueryPlugin, options);
  if (import.meta.server)
    nuxt.hooks.hook("app:rendered", () => {
      vueQueryState.value = dehydrate(queryClient);
    });
  if (import.meta.client) {
    nuxt.hooks.hook("app:created", () => {
      hydrate(queryClient, vueQueryState.value);
    });
    window.addEventListener("auth:unauthorized", () => queryClient.clear());
    persistQueryClient({
      queryClient,
      persister: createQueryPersister(),
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => query.queryKey.includes("cache"),
      },
    });
  }
  return { provide: { queryClient } };
});
