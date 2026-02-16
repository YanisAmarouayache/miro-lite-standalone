# MiroBoardComponent (standalone)

Composant Angular standalone, intégrable dans une app existante.

## API
- Input: `boardId: string` (required)

## Architecture
- `domain/`: types métier
- `application/`: façade de cas d'usage
- `infrastructure/`: repository HTTP
- `presentation/`: composant standalone

## Notes
- Pas d'auth
- Backend minimal: GET/PUT board
