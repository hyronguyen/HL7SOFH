# 🚀 Hướng Dẫn Deploy lên GitHub Pages

## Bước 1: Tạo GitHub Repository

### Cách 1: Repository mới
```bash
# Tạo folder mới (nếu chưa có)
mkdir isofh-testing-tool
cd isofh-testing-tool

# Initialize Git
git init

# Add files
git add .

# Commit
git commit -m "Initial commit"

# Thêm remote (thay your-username và your-repo)
git remote add origin https://github.com/your-username/your-repo.git

# Push lên GitHub
git branch -M main
git push -u origin main
```

### Cách 2: Clone existing repository
```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo

# Copy tất cả files vào folder này
# Commit & push
git add .
git commit -m "Add ITT modules"
git push
```

## Bước 2: Cấu Hình GitHub Pages

### Tùy Chọn A: Từ main branch (khuyên dùng)
1. Đi tới **Settings** của repository
2. Scroll xuống **Pages** section
3. Chọn:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` → `/root`
4. Click **Save**

### Tùy Chọn B: Từ docs folder
```bash
# Tạo docs folder
mkdir docs

# Copy tất cả files vào docs
cp -r * docs/
rm -rf docs/.git*

# Commit
git add docs/
git commit -m "Add docs for GitHub Pages"
git push
```

Rồi trong Settings, chọn **Source**: `main` → `/docs`

### Tùy Chọn C: Từ gh-pages branch
```bash
# Tạo branch gh-pages
git checkout --orphan gh-pages

# Xóa tất cả files
git rm -rf .

# Copy files cần deploy
git add .
git commit -m "Initial gh-pages"
git push origin gh-pages
```

Rồi trong Settings, chọn **Source**: `gh-pages` → `/root`

## Bước 3: Kiểm Tra Kết Quả

Sau ~1-2 phút, trang sẽ có sẵn tại:

```
https://your-username.github.io/your-repo/
```

Hoặc nếu là user/org page:
```
https://your-username.github.io/
```

## 🔧 Cấu Trúc File để Deploy

```
root/
├── index.html          ← Entry point
├── README.md
├── .gitignore
├── assets/
│   ├── css/
│   └── js/
└── modules/
    ├── batch-cls/
    ├── lis-oru/
    ├── tao-duo-lieu-kham/
    └── tao-bien-ban/
```

⚠️ **Quan trọng**: File `index.html` phải nằm ở root folder để GitHub Pages tìm thấy.

## 🔐 Custom Domain (Optional)

Để sử dụng domain riêng:

1. Mua domain (VD: GoDaddy, Namecheap)
2. Configure DNS:
   - **Option A**: A record → `185.199.108.153`
   - **Option B**: CNAME → `your-username.github.io`
3. Trong Settings, chọn **Custom domain** → nhập `yourdomain.com`
4. Click **Save**
5. Enable **Enforce HTTPS** (khuyến nghị)

## 🐛 Troubleshooting

### Trang không xuất hiện sau push
- Chờ 2-5 phút, refresh browser
- Xem **Settings → Pages** xem có error không
- Kiểm tra workflow logs: **Actions** tab

### 404 Not Found
- Đảm bảo `index.html` ở root folder
- Kiểm tra cấu trúc folder đúng
- Xóa cache browser (Ctrl+Shift+Delete)

### CSS/JS không load
- Đảm bảo paths là relative (VD: `./assets/css/style.css`)
- Không dùng absolute paths như `/assets/...`
- Nếu repo là subfolder, thêm base path vào HTML

### API CORS error
Nếu gặp lỗi CORS khi call API:
1. Sử dụng CORS proxy: `https://cors-anywhere.herokuapp.com/`
2. Hoặc request từ backend thay vì frontend

## 📊 Monitoring Deployment

### Xem deployment status
1. Đi **Settings → Pages**
2. Xem phần **Deployments**
3. Xem commit history có green checkmark

### View deployment logs
1. Đi **Actions** tab
2. Click **pages build and deployment**
3. Xem chi tiết build logs

## 🔄 Update sau Deploy

Để cập nhật trang sau khi deploy:

```bash
# Sửa files
# Ví dụ: edit index.html, update modules

# Commit & push
git add .
git commit -m "Update: [your changes]"
git push origin main
```

GitHub Pages sẽ tự động rebuild trong vài phút.

## 📱 Testing Locally trước Deploy

```bash
# Option 1: Dùng Python simple server
python -m http.server 8000
# Mở: http://localhost:8000

# Option 2: Dùng Node http-server
npx http-server
# Mở: http://localhost:8080

# Option 3: Dùng Live Server (VS Code extension)
# Click "Go Live" ở status bar
```

## 🎯 Best Practices

1. **Luôn dùng relative paths**
   ```html
   <!-- ✅ Đúng -->
   <link rel="stylesheet" href="./assets/css/style.css">
   
   <!-- ❌ Sai -->
   <link rel="stylesheet" href="/assets/css/style.css">
   ```

2. **Optimize images & assets**
   - Compress images
   - Minify CSS/JS
   - Lazy load images

3. **Security**
   - Không commit sensitive info (.env, passwords)
   - Enable branch protection
   - Use .gitignore properly

4. **Version control**
   - Meaningful commit messages
   - Tag releases: `git tag v1.0.0`
   - Keep CHANGELOG updated

## 📚 Tài Liệu Tham Khảo

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [GitHub Pages Troubleshooting](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages#limits-on-use-of-github-pages)
- [Jekyll Documentation](https://jekyllrb.com/) (nếu dùng)

## 💡 Tips

- Enable GitHub Pages Actions workflows để tự động build
- Dùng GitHub secrets để lưu sensitive data
- Set up branch protection rules cho `main`
- Regular backups của repository

---

**Last Updated**: 20/05/2026  
**For**: ISOFH Testing Tool v1.0.0
