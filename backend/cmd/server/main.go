package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"miro-lite-standalone/backend/internal/board"
)

func main() {
	svc := board.NewService("data/boards.json")

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("/api/boards/", svc.HandleBoard)

	handler := withCORS(mux)
	log.Println("backend listening on :8091")
	if err := http.ListenAndServe(":8091", handler); err != nil {
		log.Fatal(err)
	}
}

func withCORS(next http.Handler) http.Handler {
	allowedOrigins := parseAllowedOrigins(os.Getenv("ALLOWED_ORIGINS"))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		isAllowedOrigin := origin != "" && allowedOrigins[origin]
		if isAllowedOrigin {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET,PUT,OPTIONS")
		if r.Method == http.MethodOptions {
			if origin != "" && !isAllowedOrigin {
				http.Error(w, "origin not allowed", http.StatusForbidden)
				return
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if origin != "" && !isAllowedOrigin {
			http.Error(w, "origin not allowed", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func parseAllowedOrigins(raw string) map[string]bool {
	if strings.TrimSpace(raw) == "" {
		raw = "http://localhost:4200,http://localhost:4201"
	}
	origins := make(map[string]bool)
	for _, value := range strings.Split(raw, ",") {
		origin := strings.TrimSpace(value)
		if origin == "" {
			continue
		}
		origins[origin] = true
	}
	return origins
}
