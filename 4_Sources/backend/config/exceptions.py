from rest_framework.views import exception_handler


def _flatten_error_codes(detail):
    if hasattr(detail, "get_codes"):
        return detail.get_codes()
    return None


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return response

    data = response.data
    codes = _flatten_error_codes(getattr(exc, "detail", data))

    if isinstance(data, dict) and set(data.keys()) <= {"detail", "code", "field_errors"}:
        data.setdefault("field_errors", {})
        data.setdefault("code", getattr(exc, "default_code", "error"))
        response.data = data
        return response

    if isinstance(data, dict) and "detail" in data and len(data) == 1:
        response.data = {
            "detail": data["detail"],
            "field_errors": {},
            "code": codes if isinstance(codes, str) else getattr(exc, "default_code", "error"),
        }
        return response

    response.data = {
        "detail": "Validation error." if response.status_code == 400 else "Request failed.",
        "field_errors": data if isinstance(data, dict) else {"non_field_errors": data},
        "code": codes or getattr(exc, "default_code", "error"),
    }
    return response
