# The production socket accepts IPv4 and IPv6 connections (Railway private networking).
import socket

import pytest

from src.api.serve import dual_stack_socket


def connects(family, host, port):
    with socket.socket(family, socket.SOCK_STREAM) as client:
        client.settimeout(2)
        client.connect((host, port))
        return True


@pytest.mark.skipif(not socket.has_ipv6, reason="no IPv6 support")
def test_socket_accepts_ipv4_and_ipv6():
    server = dual_stack_socket(0)
    try:
        server.listen()
        port = server.getsockname()[1]

        assert server.family == socket.AF_INET6
        assert server.getsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY) == 0
        assert connects(socket.AF_INET, "127.0.0.1", port)
        assert connects(socket.AF_INET6, "::1", port)
    finally:
        server.close()
