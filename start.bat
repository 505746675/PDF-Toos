@echo off
echo ========================================
echo Vue PDF Tools - 启动脚本
echo ========================================
echo.

echo 1. 安装依赖 (如果尚未安装)
echo 2. 启动开发服务器
echo 3. 构建生产版本
echo 4. 退出
echo.

set /p choice="请选择操作 (1-4): "

if "%choice%"=="1" (
    echo.
    echo 正在安装依赖...
    npm install
    echo.
    echo 依赖安装完成！
    pause
    goto start
)

if "%choice%"=="2" (
    echo.
    echo 正在启动开发服务器...
    npm run dev
    goto end
)

if "%choice%"=="3" (
    echo.
    echo 正在构建生产版本...
    npm run build
    echo.
    echo 构建完成！文件位于 dist 目录
    pause
    goto start
)

if "%choice%"=="4" (
    goto end
)

echo.
echo 无效选择！
pause
goto start

:start
echo.
echo ========================================
echo 感谢使用 Vue PDF Tools！
echo ========================================
echo.
echo 项目结构：
echo   src/          - 源代码目录
echo   dist/         - 构建输出目录
echo   package.json  - 项目配置
echo   vite.config.js - 构建配置
echo.
echo 快速开始：
echo   1. 运行 npm install 安装依赖
echo   2. 运行 npm run dev 启动开发服务器
echo   3. 访问 http://localhost:3000
echo.
echo 主要功能：
echo   - PDF文件导入和预览
echo   - 页面选择、旋转、删除
echo   - 拖拽排序
echo   - 页面替换
echo   - PDF合并和导出
echo   - 转换为PNG图片
echo.
pause

:end
exit