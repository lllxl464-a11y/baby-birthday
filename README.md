# 无界像集

一个无需后端的静态图库，适合部署到 GitHub Pages。

## 本地预览

```bash
cd site
python3 -m http.server 8080
```

访问 `http://localhost:8080`。

## 更新图库

将新图片放入 `图片工厂/横屏/<分类>/` 或 `图片工厂/竖屏/<分类>/` 后运行：

```bash
python3 site/tools/build_gallery.py
```

脚本会生成网页预览图和 `site/data/gallery.json`。预览图最长边为 1280px，不会改动原图。

## 发布到 GitHub Pages

1. 新建 GitHub 仓库，并将本项目提交到仓库。
2. 仓库 Settings → Pages → Build and deployment。
3. 如果只发布 `site` 目录，可将其改名为 `docs`，选择 `Deploy from a branch`、`main`、`/docs`。
4. 也可以把 `site` 单独作为一个仓库，选择 `main`、`/(root)`。

上线前在 `app.js` 顶部填写 `xiaohongshuUrl`。建议只发布 `site`，不要把 2GB 原始素材全部提交到公开仓库。
