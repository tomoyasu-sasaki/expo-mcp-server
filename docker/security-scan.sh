#!/bin/bash
# =============================================================================
# Docker Security Scan Script for Expo MCP Server
# =============================================================================

set -e

echo "🔐 Starting Docker Security Scan..."

IMAGE_NAME="${1:-expo-mcp-server}"
SCAN_REPORT_DIR="./docker/security-reports"

# レポートディレクトリ作成
mkdir -p "${SCAN_REPORT_DIR}"

echo "📋 Scanning image: ${IMAGE_NAME}"

# 1. Docker Scout (if available)
if command -v docker &> /dev/null; then
    echo "🔍 Running Docker Scout security scan..."
    
    # Docker Scout でCVE スキャン
    if docker scout --help &> /dev/null 2>&1; then
        docker scout cves "${IMAGE_NAME}" > "${SCAN_REPORT_DIR}/docker-scout-cves.txt" || echo "⚠️  Docker Scout CVE scan failed"
        docker scout recommendations "${IMAGE_NAME}" > "${SCAN_REPORT_DIR}/docker-scout-recommendations.txt" || echo "⚠️  Docker Scout recommendations failed"
    else
        echo "ℹ️  Docker Scout not available, skipping..."
    fi
fi

# 2. Trivy (if available)
if command -v trivy &> /dev/null; then
    echo "🔍 Running Trivy security scan..."
    trivy image --format table "${IMAGE_NAME}" > "${SCAN_REPORT_DIR}/trivy-scan.txt" || echo "⚠️  Trivy scan failed"
    trivy image --format json "${IMAGE_NAME}" > "${SCAN_REPORT_DIR}/trivy-scan.json" || echo "⚠️  Trivy JSON report failed"
else
    echo "ℹ️  Trivy not available, skipping..."
fi

# 3. Docker Bench Security (基本的なセキュリティチェック)
echo "🔍 Running basic security checks..."

# イメージ情報収集
docker inspect "${IMAGE_NAME}" > "${SCAN_REPORT_DIR}/image-inspect.json" 2>/dev/null || echo "⚠️  Image inspection failed"

# セキュリティ設定確認
echo "📋 Security Configuration Check:" > "${SCAN_REPORT_DIR}/security-check.txt"
echo "=================================" >> "${SCAN_REPORT_DIR}/security-check.txt"

# 非rootユーザー確認
USER_CHECK=$(docker inspect "${IMAGE_NAME}" | grep -i '"User"' || echo "User: not set")
echo "User Setting: ${USER_CHECK}" >> "${SCAN_REPORT_DIR}/security-check.txt"

# Dockerfile安全性チェック
if [ -f "Dockerfile" ]; then
    echo "" >> "${SCAN_REPORT_DIR}/security-check.txt"
    echo "Dockerfile Security Analysis:" >> "${SCAN_REPORT_DIR}/security-check.txt"
    echo "----------------------------" >> "${SCAN_REPORT_DIR}/security-check.txt"
    
    # 危険なパターンチェック
    grep -n "ADD\|COPY.*--chown" Dockerfile >> "${SCAN_REPORT_DIR}/security-check.txt" || echo "No chown operations found" >> "${SCAN_REPORT_DIR}/security-check.txt"
    grep -n "USER" Dockerfile >> "${SCAN_REPORT_DIR}/security-check.txt" || echo "No USER directive found" >> "${SCAN_REPORT_DIR}/security-check.txt"
    grep -n "HEALTHCHECK" Dockerfile >> "${SCAN_REPORT_DIR}/security-check.txt" || echo "No HEALTHCHECK found" >> "${SCAN_REPORT_DIR}/security-check.txt"
fi

# 4. 依存関係の脆弱性チェック (package.json)
if [ -f "package.json" ]; then
    echo "🔍 Checking npm dependencies for vulnerabilities..."
    npm audit --audit-level moderate > "${SCAN_REPORT_DIR}/npm-audit.txt" 2>&1 || echo "⚠️  npm audit completed with warnings"
fi

# 5. セキュリティ設定検証
echo "🔍 Verifying security configurations..."

# docker-compose.yml セキュリティ設定確認
if [ -f "docker-compose.yml" ]; then
    echo "" >> "${SCAN_REPORT_DIR}/security-check.txt"
    echo "Docker Compose Security Settings:" >> "${SCAN_REPORT_DIR}/security-check.txt"
    echo "--------------------------------" >> "${SCAN_REPORT_DIR}/security-check.txt"
    
    grep -n "no-new-privileges\|read_only\|cap_drop\|security_opt" docker-compose.yml >> "${SCAN_REPORT_DIR}/security-check.txt" || echo "Basic security settings may be missing" >> "${SCAN_REPORT_DIR}/security-check.txt"
fi

echo "✅ Security scan completed!"
echo "📄 Reports saved to: ${SCAN_REPORT_DIR}/"
echo ""
echo "📋 Summary:"
echo "- Image inspection: ${SCAN_REPORT_DIR}/image-inspect.json"
echo "- Security check: ${SCAN_REPORT_DIR}/security-check.txt"
echo "- npm audit: ${SCAN_REPORT_DIR}/npm-audit.txt"

if [ -f "${SCAN_REPORT_DIR}/trivy-scan.txt" ]; then
    echo "- Trivy scan: ${SCAN_REPORT_DIR}/trivy-scan.txt"
fi

if [ -f "${SCAN_REPORT_DIR}/docker-scout-cves.txt" ]; then
    echo "- Docker Scout CVEs: ${SCAN_REPORT_DIR}/docker-scout-cves.txt"
fi

echo ""
echo "🔐 Please review the security reports before deploying to production!" 