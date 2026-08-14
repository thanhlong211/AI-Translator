package com.dangt.aitranslator.backend.config;

import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class ApiRateLimitFilterTest {

    @Test
    void rejectsSecondLoginInsideSameWindow() throws Exception {
        ApiRateLimitFilter filter = new ApiRateLimitFilter(
                JsonMapper.builder().findAndAddModules().build(),
                true,
                1, 300,
                1, 300,
                1, 3600,
                1, 900,
                1, 300,
                1, 60,
                1, 60,
                1, 60
        );

        MockHttpServletRequest first = request("/api/v1/auth/login");
        MockHttpServletResponse firstResponse = new MockHttpServletResponse();
        filter.doFilter(first, firstResponse, new MockFilterChain());
        assertThat(firstResponse.getStatus()).isEqualTo(200);

        MockHttpServletRequest second = request("/api/v1/auth/login");
        MockHttpServletResponse secondResponse = new MockHttpServletResponse();
        filter.doFilter(second, secondResponse, new MockFilterChain());

        assertThat(secondResponse.getStatus()).isEqualTo(429);
        assertThat(secondResponse.getHeader("Retry-After")).isNotBlank();
        assertThat(secondResponse.getContentAsString()).contains("RATE_LIMITED");
    }

    private MockHttpServletRequest request(String path) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
        request.setRemoteAddr("127.0.0.1");
        return request;
    }
}
