"""Production entry point: runs the API on one dual-stack socket (IPv4 and IPv6) on $PORT.

`uvicorn --host ::` listens on IPv6 only (asyncio sets IPV6_V6ONLY), so IPv4 clients get "connection
refused". Railway's private network resolves <service>.railway.internal to IPv4 and IPv6 (new environments)
or IPv6 only (older ones), so the socket must accept both. Where IPv6 isn't available it falls back to IPv4.

    python -m src.api.serve        # PORT defaults to 8000
"""

import os
import socket

import uvicorn


def dual_stack_socket(port: int) -> socket.socket:
    try:
        sock = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
        sock.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        address = ("::", port)
    except (OSError, AttributeError):  # no IPv6 in this environment
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        address = ("0.0.0.0", port)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(address)
    sock.set_inheritable(True)
    return sock


def main():
    port = int(os.environ.get("PORT", "8000"))
    config = uvicorn.Config("src.api.main:app", proxy_headers=False, server_header=False)
    uvicorn.Server(config).run(sockets=[dual_stack_socket(port)])


if __name__ == "__main__":
    main()
