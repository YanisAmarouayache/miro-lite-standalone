package main

import (
	"net/http"
	"os"
	"strings"
)

func withCORS(next http.Handler) http.Handler {
	allowedOrigins := parseAllowedOrigins(os.Getenv("ALLOWED_ORIGINS"))
	allowedHeaders := parseAllowedHeaders(os.Getenv("ALLOWED_HEADERS"))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		isAllowedOrigin := origin == "" || allowedOrigins[origin]

		if !isAllowedOrigin {
			rejectCORS(w, r)
			return
		}

		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}

		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Headers", allowedHeaders)
			w.Header().Set("Access-Control-Allow-Methods", "GET,PUT,POST,OPTIONS")
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func rejectCORS(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/graphql") {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"errors":[{"message":"origin not allowed"}]}`))
		return
	}
	http.Error(w, "origin not allowed", http.StatusForbidden)
}

func parseAllowedOrigins(raw string) map[string]bool {
	if strings.TrimSpace(raw) == "" {
		raw = "http://localhost:4200,http://localhost:4201,http://localhost:8091"
	}
	origins := make(map[string]bool)
	for _, value := range strings.Split(raw, ",") {
		if origin := strings.TrimSpace(value); origin != "" {
			origins[origin] = true
		}
	}
	return origins
}

func parseAllowedHeaders(raw string) string {
	const defaultHeaders = "Content-Type,Authorization,Apollo-Require-Preflight,X-Requested-With,Accept,Origin"
	if strings.TrimSpace(raw) == "" {
		return defaultHeaders
	}
	seen := make(map[string]bool)
	headers := make([]string, 0)
	for _, value := range strings.Split(raw, ",") {
		header := strings.TrimSpace(value)
		if header == "" {
			continue
		}
		if key := strings.ToLower(header); !seen[key] {
			seen[key] = true
			headers = append(headers, header)
		}
	}
	if len(headers) == 0 {
		return defaultHeaders
	}
	return strings.Join(headers, ",")
}
