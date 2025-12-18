import http.server
import socketserver
import webbrowser
import os


PORT = 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    # 默认从当前脚本所在目录提供静态文件
    def translate_path(self, path):
        root = os.path.dirname(os.path.abspath(__file__))
        path = http.server.SimpleHTTPRequestHandler.translate_path(self, path)
        relpath = os.path.relpath(path, os.getcwd())
        fullpath = os.path.join(root, relpath)
        return fullpath


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}/index.html"
        print(f"本地服务器已启动：{url}")
        print("按 Ctrl+C 停止服务器。")
        try:
            # 自动在默认浏览器中打开游戏页面
            webbrowser.open(url)
        except Exception:
            pass
        httpd.serve_forever()


