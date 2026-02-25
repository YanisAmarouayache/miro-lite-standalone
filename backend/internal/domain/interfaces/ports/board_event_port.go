package ports

import "miro-lite-standalone/backend/internal/domain/model"

type BoardEventPort interface {
	Publish(board *model.Board)
}
