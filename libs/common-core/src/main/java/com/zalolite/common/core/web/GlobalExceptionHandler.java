package com.zalolite.common.core.web;

import com.zalolite.common.core.ApiResponse;
import com.zalolite.common.core.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.stream.Collectors;

/** One error format for every servlet service: { success: false, message }. */
@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BusinessException.class)
    ResponseEntity<ApiResponse<Void>> business(BusinessException exception) {
        return respond(exception.getStatus(), exception.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiResponse<Void>> validation(MethodArgumentNotValidException exception) {
        String detail = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return respond(422, detail.isEmpty() ? "Dữ liệu không hợp lệ" : "Dữ liệu không hợp lệ (" + detail + ")");
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    ResponseEntity<ApiResponse<Void>> missingHeader(MissingRequestHeaderException exception) {
        if ("X-User-Id".equalsIgnoreCase(exception.getHeaderName())) {
            return respond(401, "Chưa đăng nhập");
        }
        return respond(400, "Thiếu header " + exception.getHeaderName());
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class})
    ResponseEntity<ApiResponse<Void>> badRequest(Exception exception) {
        return respond(400, "Yêu cầu không hợp lệ");
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ApiResponse<Void>> tooLarge(MaxUploadSizeExceededException exception) {
        return respond(413, "Tệp vượt quá dung lượng cho phép");
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ApiResponse<Void>> notFound(NoResourceFoundException exception) {
        return respond(404, "Không tìm thấy tài nguyên");
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ApiResponse<Void>> method(HttpRequestMethodNotSupportedException exception) {
        return respond(405, "Phương thức không được hỗ trợ");
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiResponse<Void>> unexpected(Exception exception) {
        log.error("Unhandled error", exception);
        return respond(500, "Lỗi hệ thống, vui lòng thử lại");
    }

    private ResponseEntity<ApiResponse<Void>> respond(int status, String message) {
        return ResponseEntity.status(HttpStatus.valueOf(status)).body(ApiResponse.error(message));
    }
}
