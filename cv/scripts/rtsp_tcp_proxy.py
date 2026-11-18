#!/usr/bin/env python3
"""Small TCP forwarder for local RTSP development.

This is useful on macOS when a managed Python runtime cannot open LAN sockets but
the system Python can. RTSP must use interleaved TCP when routed through it.
"""

import argparse
import select
import socket
import socketserver


class ProxyHandler(socketserver.BaseRequestHandler):
    def handle(self):
        upstream = socket.create_connection(
            (self.server.target_host, self.server.target_port), timeout=10
        )
        try:
            sockets = (self.request, upstream)
            while True:
                readable, _, _ = select.select(sockets, (), (), 30)
                if not readable:
                    continue
                for source in readable:
                    data = source.recv(64 * 1024)
                    if not data:
                        return
                    destination = upstream if source is self.request else self.request
                    destination.sendall(data)
        finally:
            upstream.close()


class ProxyServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self, address, handler, target_host, target_port):
        self.target_host = target_host
        self.target_port = target_port
        super().__init__(address, handler)


def main():
    parser = argparse.ArgumentParser(description="Forward a local TCP port to an RTSP camera")
    parser.add_argument("--listen-host", default="127.0.0.1")
    parser.add_argument("--listen-port", type=int, default=18554)
    parser.add_argument("--target-host", required=True)
    parser.add_argument("--target-port", type=int, default=554)
    args = parser.parse_args()

    with ProxyServer(
        (args.listen_host, args.listen_port),
        ProxyHandler,
        args.target_host,
        args.target_port,
    ) as server:
        print(
            f"RTSP TCP proxy listening on {args.listen_host}:{args.listen_port} "
            f"-> {args.target_host}:{args.target_port}",
            flush=True,
        )
        server.serve_forever()


if __name__ == "__main__":
    main()
