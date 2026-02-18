from fastapi import HTTPException


def not_found(detail: str = 'Resource not found.') -> HTTPException:
    return HTTPException(status_code=404, detail={'code': 'NOT_FOUND', 'message': detail, 'details': None})


def validation_error(message: str, details: dict | None = None) -> HTTPException:
    return HTTPException(status_code=422, detail={'code': 'VALIDATION_ERROR', 'message': message, 'details': details})


def internal_error(message: str = 'Unexpected error.') -> HTTPException:
    return HTTPException(status_code=500, detail={'code': 'INTERNAL_ERROR', 'message': message, 'details': None})


def unauthorized(detail: str = 'Unauthorized.') -> HTTPException:
    return HTTPException(status_code=401, detail={'code': 'UNAUTHORIZED', 'message': detail, 'details': None})


def conflict(detail: str = 'Resource already exists.') -> HTTPException:
    return HTTPException(status_code=409, detail={'code': 'CONFLICT', 'message': detail, 'details': None})
