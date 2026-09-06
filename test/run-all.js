/**
 * PuniCodex — Master Test Runner
 * Runs all Node.js test suites and reports combined results.
 * Run: node test/run-all.js
 */

const { execFile } = require('node:child_process');
const path = require('node:path');

const C = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

const SUITES = [
  // CI parity gates first: format/lint drift must fail locally, not on GitHub.
  { name: 'Format Check', cmd: 'npm run format:check', timeout: 600000, shell: true },
  { name: 'Biome Lint', cmd: 'npm run lint', timeout: 600000, shell: true },
  { name: 'Lexicon Validator', cmd: 'node type/js/validate.js' },
  { name: 'Engine Unit Tests', cmd: 'node type/js/test-engine.js' },
  { name: 'Card Engine Tests', cmd: 'node --test test/card-engine.test.js' },
  { name: 'Generated Card Set Tests', cmd: 'node --test test/cards.test.js' },
  { name: 'Cards API Tests', cmd: 'node --test test/cards-api.test.js' },
  { name: 'Scholars Taxonomy Tests', cmd: 'node platform/scholars/taxonomy.test.js' },
  { name: 'Scholars Quality Gate Tests', cmd: 'node platform/scholars/quality.test.js' },
  { name: 'Scholars DB Tests', cmd: 'node platform/db/scholars/index.test.js' },
  { name: 'Scholars Auth Tests', cmd: 'node platform/scholars/auth.test.js' },
  { name: 'Scholars AuthZ Tests', cmd: 'node platform/scholars/authz.test.js' },
  { name: 'Scholars API Tests', cmd: 'node platform/scholars/router.test.js' },
  { name: 'Scholars Dept Admin Tests', cmd: 'node platform/scholars/dept-admin.test.js' },
  { name: 'Scholars Content Regression', cmd: 'node test/scholars-content.test.js' },
  { name: 'Scholars API Flow Regression', cmd: 'node test/scholars-api-flow.test.js' },
  { name: 'Flagship Blog Tests', cmd: 'node --test test/blog.test.js' },
  { name: 'Blog Index Tests', cmd: 'node --test test/blog-index.test.js', timeout: 120000 },
  {
    name: 'Scholars Session Revocation Tests',
    cmd: 'node platform/scholars/session-revocation.test.js',
  },
  { name: 'Scholars Load Tests', cmd: 'node platform/scholars/load.test.js' },
  { name: 'Scholars Concurrency Tests', cmd: 'node platform/scholars/concurrency.test.js' },
  { name: 'Oracle Tests', cmd: 'node test/oracle.test.js' },
  {
    name: 'Oracle Eval Battery',
    cmd: 'node test/oracle-eval.test.js',
    timeout: 60000,
  },
  { name: 'Oracle Backend Flag Tests', cmd: 'node test/oracle-backend-flag.test.js' },
  { name: 'Oracle Page Tests', cmd: 'node test/oracle-page.test.js' },
  { name: 'LLM Client Tests', cmd: 'node test/llm-client.test.js' },
  { name: 'Search v2 Tests', cmd: 'node test/search-v2.test.js' },
  { name: 'Browser Shell Tests', cmd: 'node test/browser-shell.test.js' },
  { name: 'Workspace Tests', cmd: 'node test/workspaces.test.js' },
  { name: 'Gamification Tests', cmd: 'node test/gamification.test.js' },
  { name: 'Marketplace Tests', cmd: 'node test/marketplace.test.js' },
  { name: 'Creative Marketplace Tests', cmd: 'node test/creative-marketplace.test.js' },
  {
    name: 'Creator Merch Tests',
    cmd: 'node test/creator-merch.test.js',
    timeout: 60000,
  },
  { name: 'WebP Upload Pipeline Tests', cmd: 'node test/image-webp.test.js', timeout: 60000 },
  { name: 'Store Orders Tests', cmd: 'node test/store-orders.test.js', timeout: 60000 },
  { name: 'Store Checkout Tests', cmd: 'node test/store-checkout.test.js', timeout: 60000 },
  { name: 'Store Webhook Tests', cmd: 'node test/store-webhook.test.js', timeout: 60000 },
  { name: 'Variant Pricing Tests', cmd: 'node test/variant-pricing.test.js', timeout: 60000 },
  { name: 'Printful Webhook Tests', cmd: 'node test/printful-webhook.test.js', timeout: 60000 },
  { name: 'Industry Patterns Tests', cmd: 'node test/industry-patterns.test.js', timeout: 60000 },
  { name: 'Patterns Atlas Tests', cmd: 'node test/patterns-atlas.test.js', timeout: 60000 },
  { name: 'Store Structure Tests', cmd: 'node test/store-structure.test.js', timeout: 120000 },
  {
    name: 'Newsletter Subscribe Tests',
    cmd: 'node test/newsletter-subscribe.test.js',
    timeout: 60000,
  },
  { name: 'Contact Endpoint Tests', cmd: 'node test/contact-endpoint.test.js', timeout: 60000 },
  { name: 'Careers Endpoint Tests', cmd: 'node test/careers-endpoint.test.js', timeout: 60000 },
  {
    name: 'Arbitrage Endpoint Tests',
    cmd: 'node test/arbitrage-endpoint.test.js',
    timeout: 60000,
  },
  {
    name: 'API Security Contracts',
    cmd: 'node test/api-security-contracts.test.js',
    timeout: 60000,
  },
  {
    name: 'Booking Lifecycle E2E',
    cmd: 'node test/booking-lifecycle.test.js',
    timeout: 120000,
  },
  {
    name: 'Middleware Execution Tests',
    cmd: 'node test/middleware-routing.test.js',
    timeout: 120000,
  },
  {
    name: 'Browser E2E Tests',
    cmd: 'node test/browser-e2e.test.js',
    timeout: 300000,
  },
  { name: 'Herald Beacon Tests', cmd: 'node test/herald-beacon.test.js', timeout: 300000 },
  { name: 'Tier Consistency Tests', cmd: 'node test/tier-consistency.test.js', timeout: 60000 },
  { name: 'Crosslink Tests', cmd: 'node test/crosslink.test.js', timeout: 120000 },
  { name: 'Pantheon Meta Contract', cmd: 'node test/pantheon-meta.test.js', timeout: 60000 },
  {
    name: 'Pantheon Landing Page Tests',
    cmd: 'node test/pantheon-landings.test.js',
    timeout: 60000,
  },
  {
    name: 'Screen Guide Tests',
    cmd: 'node test/screen-guide.test.js',
    timeout: 60000,
  },
  {
    name: 'Herald Page Tests',
    cmd: 'node --test test/herald-page.test.js',
    timeout: 60000,
  },
  { name: 'Lexicon Dedup Contract', cmd: 'node test/lexicon-dedup.test.js', timeout: 60000 },
  { name: 'Agents Tests', cmd: 'node test/agents.test.js' },
  { name: 'Multimodal Tests', cmd: 'node test/multimodal.test.js' },
  { name: 'Partner Tests', cmd: 'node test/partners.test.js' },
  { name: 'API v1 Integration Tests', cmd: 'node test/api-v1.test.js' },
  {
    name: 'Pronunciation Engine Tests',
    cmd: 'node --test test/pronunciation.test.js',
    timeout: 60000,
  },
  { name: 'API Auth Tests', cmd: 'node test/api-auth.test.js' },
  { name: 'API Utils Tests', cmd: 'node test/api-utils.test.js' },
  { name: 'Client IP Tests', cmd: 'node test/client-ip.test.js' },
  { name: 'Rate Limiter Tests', cmd: 'node test/rate-limiter.test.js' },
  { name: 'Redis Client Resilience Tests', cmd: 'node test/redis-client.test.js' },
  { name: 'Security Hardening Tests', cmd: 'node test/security-hardening.test.js' },
  { name: 'Safe JSON Tests', cmd: 'node test/safe-json.test.js' },
  { name: 'Operational DB Tests', cmd: 'node test/operational-db.test.js' },
  { name: 'Availability Checker Tests', cmd: 'node test/availability-checker.test.js' },
  { name: 'Foundation Tests', cmd: 'node test/foundations.test.js' },
  { name: 'Search Service Tests', cmd: 'node test/search.test.js' },
  { name: 'Temple Content Search Tests', cmd: 'node test/search-temples.test.js', timeout: 60000 },
  { name: 'Search Gating Tests', cmd: 'node test/search-gating.test.js', timeout: 60000 },
  { name: 'Crawler DB Tests', cmd: 'node test/crawler-db.test.js' },
  { name: 'API v2 Integration Tests', cmd: 'node test/api-v2.test.js' },
  { name: 'OpenAPI Contract Tests', cmd: 'node test/openapi-contract.test.js' },
  { name: 'Appraisal Tests', cmd: 'node test/appraise.test.js' },
  { name: 'Observability Tests', cmd: 'node test/observability.test.js' },
  { name: 'Admin Tests', cmd: 'node test/admin.test.js' },
  { name: 'Admin Booking Routes', cmd: 'node test/admin-bookings.test.js' },
  { name: 'Admin Portal Tests', cmd: 'node test/admin-portal.test.js', timeout: 60000 },
  { name: 'Admin Role Floor Tests', cmd: 'node test/admin-role-floor.test.js', timeout: 60000 },
  {
    name: 'Admin Portal Growth Tests',
    cmd: 'node test/admin-portal-growth.test.js',
    timeout: 60000,
  },
  {
    name: 'Admin Route Auth Contract Tests',
    cmd: 'node test/admin-route-auth.test.js',
    timeout: 60000,
  },
  {
    name: 'Admin Analytics Authority Tests',
    cmd: 'node test/admin-analytics-authority.test.js',
    timeout: 60000,
  },
  {
    name: 'Admin Creative Review Tests',
    cmd: 'node --test test/admin-creative-review.test.js',
  },
  {
    name: 'Admin Command Notifications Tests',
    cmd: 'node --test test/admin-command-notifications.test.js',
  },
  { name: 'Patrons API Tests', cmd: 'node test/patrons-api.test.js', timeout: 60000 },
  { name: 'Stripe Webhook Tests', cmd: 'node test/stripe-webhook.test.js' },
  { name: 'Ad Analytics Tests', cmd: 'node test/ad-analytics.test.js' },
  {
    name: 'Analytics Schema Drift Tests',
    cmd: 'node --test test/analytics-schema-drift.test.js',
  },
  {
    name: 'Site Analytics Tests',
    cmd: 'node test/site-analytics.test.js',
    timeout: 900000,
  },
  { name: 'Booking Service Tests', cmd: 'node test/booking-service.test.js' },
  { name: 'Booking Validation Tests', cmd: 'node test/booking-validation.test.js' },
  { name: 'Flagship Slots Tests', cmd: 'node --test test/flagship-slots.test.js' },
  {
    name: 'Booking Publish/Pause Tests',
    cmd: 'node --test test/booking-publish-pause.test.js',
  },
  {
    name: 'Account Booking Controls Tests',
    cmd: 'node --test test/account-booking-controls.test.js',
  },
  { name: 'Account Overview Tests', cmd: 'node --test test/account-overview.test.js' },
  {
    name: 'Sponsor Content Safety',
    cmd: 'node test/sponsor-content-safety.test.js',
    timeout: 180000,
  },
  { name: 'Patron Service Tests', cmd: 'node test/patron-service.test.js' },
  { name: 'Patron Page Tests', cmd: 'node test/patron-page.test.js', timeout: 120000 },
  { name: 'Patron Contract Tests', cmd: 'node --test test/patron-contract.test.js' },
  { name: 'Collaborators Strip Tests', cmd: 'node test/collaborators-strip.test.js' },
  { name: 'Menu Consistency Tests', cmd: 'node test/menu-consistency.test.js' },
  { name: 'Footer Consistency Tests', cmd: 'node test/footer-consistency.test.js' },
  { name: 'Texts Section Tests', cmd: 'node test/texts-section.test.js' },
  { name: 'Cookie Consent Tests', cmd: 'node test/cookie-consent.test.js' },
  { name: 'Lexicon Meaning Style Tests', cmd: 'node test/lexicon-meaning-style.test.js' },
  { name: 'Site Analytics v2 Tests', cmd: 'node test/site-analytics-v2.test.js' },
  { name: 'Analytics Depth Tests', cmd: 'node test/analytics-depth.test.js' },
  { name: 'Analytics Anomaly Tests', cmd: 'node --test test/analytics-anomaly.test.js' },
  { name: 'Analytics Quality Tests', cmd: 'node --test test/analytics-quality.test.js' },
  { name: 'Analytics Funnels Tests', cmd: 'node --test test/analytics-funnels.test.js' },
  { name: 'Analytics Cohorts Tests', cmd: 'node --test test/analytics-cohorts.test.js' },
  { name: 'Analytics LTV Tests', cmd: 'node --test test/analytics-ltv.test.js' },
  { name: 'Analytics Realtime Tests', cmd: 'node --test test/analytics-realtime.test.js' },
  { name: 'Analytics Edge Cases Tests', cmd: 'node --test test/analytics-edge-cases.test.js' },
  { name: 'Analytics Red Team Tests', cmd: 'node --test test/analytics-red-team.test.js' },
  { name: 'Analytics Rollups Tests', cmd: 'node --test test/analytics-rollups.test.js' },
  { name: 'Analytics Retention Tests', cmd: 'node --test test/analytics-retention.test.js' },
  { name: 'Admin Analytics V2 Tests', cmd: 'node --test test/admin-analytics-v2.test.js' },
  {
    name: 'Trending Page Tests',
    cmd: 'node test/trending-page.test.js',
    timeout: 120000,
  },
  { name: 'Search Page Tests', cmd: 'node test/search-page.test.js' },
  { name: 'Brand Tests', cmd: 'node test/brand.test.js' },
  { name: 'Admin Portal Page Tests', cmd: 'node test/admin-portal-page.test.js' },
  { name: 'Portal Shell v2 Tests', cmd: 'node test/portal-shell-v2.test.js', timeout: 60000 },
  { name: 'Portal Endpoints Tests', cmd: 'node test/portal-endpoints.test.js', timeout: 60000 },
  { name: 'Portal Leasing Tests', cmd: 'node test/portal-leasing.test.js', timeout: 60000 },
  { name: 'Discount Codes Tests', cmd: 'node test/discount-codes.test.js', timeout: 60000 },
  { name: 'Pitch Email Tests', cmd: 'node test/pitch-email.test.js', timeout: 60000 },
  { name: 'Everyday + Ink Tests', cmd: 'node test/everyday-ink.test.js', timeout: 60000 },
  { name: 'Terms Coverage Tests', cmd: 'node test/terms-coverage.test.js', timeout: 60000 },
  {
    name: 'Creative Upload Pipeline Tests',
    cmd: 'node test/creative-upload.test.js',
    timeout: 60000,
  },
  { name: 'Creative Studio Tests', cmd: 'node --test test/creative-studio.test.js' },
  { name: 'Type Tool Forms Tests', cmd: 'node test/type-tool-forms.test.js', timeout: 60000 },
  { name: 'Reservation Expiry Tests', cmd: 'node test/reservation-expiry.test.js', timeout: 60000 },
  {
    name: 'Founding Codes Seed Tests',
    cmd: 'node test/founding-codes-seed.test.js',
    timeout: 60000,
  },
  {
    name: 'Portal Store Orders Tests',
    cmd: 'node test/portal-store-orders.test.js',
    timeout: 60000,
  },
  {
    name: 'Service Worker Contract Tests',
    cmd: 'node test/service-worker.test.js',
    timeout: 30000,
  },
  { name: 'Discount Modal Tests', cmd: 'node test/discount-modal.test.js', timeout: 60000 },
  {
    name: 'Operational Transaction Contract Tests',
    cmd: 'node test/operational-transaction.test.js',
    timeout: 30000,
  },
  { name: 'Texts Chapters Tests', cmd: 'node test/texts-chapters.test.js', timeout: 60000 },
  { name: 'Cards Gallery Tests', cmd: 'node test/cards-gallery.test.js', timeout: 30000 },
  { name: 'Cards Editions Tests', cmd: 'node --test test/cards-editions.test.js', timeout: 30000 },
  {
    name: 'Domain-less Flagship Tests',
    cmd: 'node --test test/domainless-flagships.test.js',
    timeout: 30000,
  },
  { name: 'Blog Series Tests', cmd: 'node test/blog-series.test.js', timeout: 60000 },
  { name: 'Mythic Duel v2 Tests', cmd: 'node test/mythic-duel-v2.test.js', timeout: 30000 },
  { name: 'Portal System Tests', cmd: 'node test/portal-system.test.js', timeout: 60000 },
  { name: 'Tenant Portal Tests', cmd: 'node test/tenant-portal.test.js', timeout: 60000 },
  {
    name: 'Membership Automation Tests',
    cmd: 'node test/membership-automation.test.js',
    timeout: 60000,
  },
  { name: 'Sponsor Sandbox Tests', cmd: 'node test/sponsor-sandbox.test.js', timeout: 60000 },
  { name: 'API Fuzz Tests', cmd: 'node test/api-fuzz.test.js', timeout: 60000 },
  { name: 'Analytics E2E Tests', cmd: 'node test/analytics-e2e.test.js' },
  {
    name: 'Analytics Instrumentation Contracts',
    cmd: 'node --test test/analytics-instrumentation-contracts.test.js',
  },
  { name: 'Vercelignore Guard', cmd: 'node test/vercelignore-guard.test.js' },
  { name: 'Secrets Guard', cmd: 'node test/secrets-guard.test.js' },
  { name: 'Security Tab Tests', cmd: 'node test/security-tab.test.js', timeout: 60000 },
  {
    name: 'Attack Simulation Tests',
    cmd: 'node test/security-attack-sim.test.js',
    timeout: 120000,
  },
  {
    name: 'Injection Extended Tests',
    cmd: 'node test/security-injection-extended.test.js',
    timeout: 120000,
  },
  {
    name: 'Authz Matrix Tests',
    cmd: 'node test/security-authz-matrix.test.js',
    timeout: 120000,
  },
  { name: 'Session Attack Tests', cmd: 'node test/security-session.test.js', timeout: 120000 },
  {
    name: 'Abuse Economics Tests',
    cmd: 'node test/security-abuse-economics.test.js',
    timeout: 120000,
  },
  {
    name: 'Security Telemetry Tests',
    cmd: 'node test/security-telemetry.test.js',
    timeout: 120000,
  },
  { name: 'Transport Posture Tests', cmd: 'node test/security-headers.test.js' },
  {
    name: 'Asset Version Tests',
    cmd: 'node test/asset-versions.test.js',
    timeout: 300000,
  },
  { name: 'Hero Stats Tests', cmd: 'node test/hero-stats.test.js' },
  { name: 'Sponsorship Flow Tests', cmd: 'node test/sponsorship-flow.test.js', timeout: 120000 },
  {
    name: 'Sponsorship State Machine Tests',
    cmd: 'node test/sponsorship-state-machine.test.js',
    timeout: 60000,
  },
  {
    name: 'Sponsorship Slot Invariant Tests',
    cmd: 'node test/sponsorship-slot-invariants.test.js',
    timeout: 60000,
  },
  {
    name: 'Account Endpoint Contract Tests',
    cmd: 'node test/account-endpoint-contracts.test.js',
    timeout: 60000,
  },
  {
    name: 'Change-Request Pipeline Tests',
    cmd: 'node test/change-request-pipeline.test.js',
    timeout: 60000,
  },
  {
    name: 'Slots Payload Contract Tests',
    cmd: 'node test/slots-payload-contract.test.js',
    timeout: 60000,
  },
  {
    name: 'Sponsorship Email Trigger Tests',
    cmd: 'node test/sponsorship-email-triggers.test.js',
    timeout: 60000,
  },
  { name: 'Banner State Decision Tests', cmd: 'node test/banner-state.test.js', timeout: 30000 },
  {
    name: 'Sponsorship UI Contract Tests',
    cmd: 'node test/sponsorship-ui-contracts.test.js',
    timeout: 30000,
  },
  { name: 'Vendored Libs Tests', cmd: 'node test/vendored-libs.test.js' },
  { name: 'Flagship Mobile Nav Tests', cmd: 'node test/flagship-mobile-nav.test.js' },
  { name: 'Realms Page Tests', cmd: 'node test/realms-page.test.js' },
  {
    name: 'Flagship Content Quality Audit',
    cmd: 'node test/flagship-content-quality.test.js',
    timeout: 120000,
  },
  { name: 'Similarity Service Tests', cmd: 'node test/similarity-service.test.js' },
  { name: 'Connection Taxonomy Tests', cmd: 'node test/connection-taxonomy.test.js' },
  { name: 'Connections Page Tests', cmd: 'node test/connections-page.test.js' },
  { name: 'Connections Helpers Tests', cmd: 'node test/connections-helpers.test.js' },
  {
    name: 'Flagship Patterns Tests',
    cmd: 'node test/flagship-patterns.test.js',
    timeout: 120000,
  },
  { name: 'Cron Single-Flight Tests', cmd: 'node test/cron-single-flight.test.js' },
  { name: 'Email Safety Tests', cmd: 'node test/email.test.js' },
  { name: 'Lexicon Entry Cases', cmd: 'node test/lexicon-entry-cases.test.js' },
  { name: 'Domain Parser Tests', cmd: 'node test/domain-parser.test.js' },
  { name: 'URL Decomposer Tests', cmd: 'node test/url-decomposer.test.js' },
  { name: 'URL Classifier Tests', cmd: 'node test/url-classifier.test.js' },
  { name: 'IDNA Validator Tests', cmd: 'node test/idna-validator.test.js' },
  { name: 'DNS Enricher Tests', cmd: 'node test/dns-enricher.test.js' },
  { name: 'Authenticity Service Tests', cmd: 'node test/authenticity-service.test.js' },
  { name: 'Authenticity Ensemble Tests', cmd: 'node test/authenticity-ensemble.test.js' },
  { name: 'Verdict Mapper Tests', cmd: 'node test/verdict-mapper.test.js' },
  { name: 'Confusable Atlas Tests', cmd: 'node test/confusable-atlas.test.js' },
  { name: 'Authenticity Threat Feed Tests', cmd: 'node test/authenticity-threat-feed.test.js' },
  { name: 'Hermès Disambiguation Tests', cmd: 'node test/hermes-disambiguation.test.js' },
  { name: 'Brand Shield Tests', cmd: 'node test/brand-shield.test.js' },
  { name: 'Threat Intelligence Stream Tests', cmd: 'node test/threat-stream.test.js' },
  { name: 'Dispute Service Tests', cmd: 'node test/dispute-service.test.js' },
  { name: 'Authenticity Case Matrix', cmd: 'node test/authenticity-cases.test.js' },
  { name: 'Confusable Atlas V2 Tests', cmd: 'node test/confusable-atlas-v2.test.js' },
  { name: 'Glyph Renderer Tests', cmd: 'node test/glyph-renderer.test.js' },
  { name: 'Authenticity SDK JS Tests', cmd: 'node test/sdk-js.test.js' },
  { name: 'Authenticity Extension v2 Tests', cmd: 'node test/extension-v2.test.js' },
  { name: 'Extensions Audit Tests', cmd: 'node test/extensions-audit.test.js' },
  { name: 'Policy Engine Tests', cmd: 'node test/policy-engine.test.js' },
  { name: 'RBAC Tests', cmd: 'node test/rbac.test.js' },
  { name: 'Audit Log Tests', cmd: 'node test/audit-log.test.js' },
  { name: 'Retention Tests', cmd: 'node test/retention.test.js' },
  { name: 'Telemetry Privacy Tests', cmd: 'node test/telemetry-privacy.test.js' },
  { name: 'Active Learning Tests', cmd: 'node test/active-learning.test.js' },
  { name: 'Drift Monitor Tests', cmd: 'node test/drift-monitor.test.js' },
  { name: 'Model Retrain Tests', cmd: 'node test/model-retrain.test.js' },
  { name: 'i18n Bundle Tests', cmd: 'node test/i18n.test.js' },
  { name: 'Interstitial Smoke Tests', cmd: 'node test/interstitial-smoke.test.js' },
  { name: 'Normalization Attack Tests', cmd: 'node test/normalization-attacks.test.js' },
  { name: 'Adversarial Generator Tests', cmd: 'node test/adversarial-generator.test.js' },
  { name: 'Red-Team CI Tests', cmd: 'node test/red-team-ci.test.js' },
  { name: 'False Positive Budget Tests', cmd: 'node test/false-positive-budget.test.js' },
  { name: 'False Negative Budget Tests', cmd: 'node test/false-negative-budget.test.js' },
  { name: 'Ecosystem Tests', cmd: 'node test/ecosystem.test.js' },
  { name: 'Protocol Tests', cmd: 'node test/protocol.test.js' },
  { name: 'Homograph Defense Tests', cmd: 'node test/homograph-defense.test.js' },
  { name: 'Tenant Ads Tests', cmd: 'node test/tenant-ads.test.js' },
  { name: 'Names Service Tests', cmd: 'node test/names-service.test.js' },
  { name: 'Keyboard Completeness Tests', cmd: 'node test/keyboard-completeness.test.js' },
  { name: 'Event Crawler Tests', cmd: 'node test/event-crawler.test.js' },
  { name: 'Spam Classifier Tests', cmd: 'node test/spam-classifier.test.js' },
  { name: 'LTR Tests', cmd: 'node test/ltr.test.js' },
  { name: 'Generated Artifacts Tests', cmd: 'node test/generated-artifacts.test.js' },
  { name: 'Generator Idempotency Tests', cmd: 'node test/generator-idempotency.test.js' },
  {
    name: 'Divergence Gate',
    cmd: 'node test/divergence-gate.test.js',
    // The gate runs `npm run generate` twice; a full generate is ~20-22 min
    // on a Windows dev machine (46 scripts, ~3100 HTML pages).
    timeout: 3600000,
  },
  {
    name: 'Brand Risk Language',
    cmd: 'node test/brand-risk-language.test.js',
    timeout: 120000,
  },
  { name: 'Frontend Smoke Tests', cmd: 'node test/frontend-smoke.test.js' },
  { name: 'API Trailing Slash Regression', cmd: 'node test/api-trailing-slash.test.js' },
  {
    name: 'Global Strip Mobile Regression',
    cmd: 'node test/global-strip-mobile-regression.test.js',
  },
  {
    name: 'Base Temple Mobile Nav',
    cmd: 'node test/base-temple-mobile-nav.test.js',
  },
  {
    name: 'Mobile Menu Consistency Tests',
    cmd: 'node --test test/mobile-menu-consistency.test.js',
  },
  {
    name: 'Provenance Mobile Regression',
    cmd: 'node test/provenance-mobile-regression.test.js',
  },
  {
    name: 'Hero Canvas Background Regression',
    cmd: 'node test/hero-canvas-background-regression.test.js',
  },
  { name: 'Mobile Share Extension Tests', cmd: 'node test/mobile-share-extension.test.js' },
  { name: 'iOS SDK Contract Tests', cmd: 'node sdk/ios/Tests/contract.test.js' },
  { name: 'Android SDK Contract Tests', cmd: 'node sdk/android/app/src/test/contract.test.js' },
  { name: 'Codex Export Tests', cmd: 'node test/codex-export.test.js' },
  { name: 'Model Corpus Tests', cmd: 'node test/model-corpus.test.js' },
  { name: 'Teacher Corpus Tests', cmd: 'node test/teacher-corpus.test.js' },
  { name: 'Safety Corpus Tests', cmd: 'node test/safety-corpus.test.js' },
  { name: 'AI Corpus Phases Tests', cmd: 'node test/ai-corpus-phases.test.js' },
  { name: 'Oracle Doctrine Corpus Tests', cmd: 'node test/oracle-doctrine-corpus.test.js' },
  { name: 'Lighthouse Thresholds', cmd: 'node --test test/lighthouse.test.js' },
  { name: 'Font Self-Hosting Tests', cmd: 'node test/fonts-selfhosted.test.js' },
  { name: 'Link Checker', cmd: 'node test/links.js', timeout: 900000 },
  {
    name: 'Accessibility Sweep',
    cmd: 'node test/a11y-sweep.test.js',
    timeout: 300000,
  },
  {
    name: 'Sitemap Consistency Tests',
    cmd: 'node test/sitemap-consistency.test.js',
    timeout: 300000,
  },
  {
    name: 'SEO Regression Tests',
    cmd: 'node test/seo-regression.test.js',
    timeout: 300000,
  },
  {
    name: 'SEO Canonical Audit',
    cmd: 'node test/seo-canonical-audit.test.js',
    timeout: 120000,
  },
  { name: 'Vercel Config Contract', cmd: 'node test/vercel-config.test.js' },
  { name: 'Router Behavior Tests', cmd: 'node test/router-behavior.test.js', timeout: 60000 },
  { name: 'Interstitial Safety', cmd: 'node test/interstitial-safety.test.js' },
  { name: 'Game Economy Safety', cmd: 'node test/game-economy-safety.test.js' },
  { name: 'SEO Validator', cmd: 'node scripts/validate-seo.js' },
  { name: 'Philological Accuracy', cmd: 'node scripts/validate-accuracy.js' },
  { name: 'Flywheel Integrity', cmd: 'node scripts/validate-flywheel.js' },
  { name: 'Original Script Provenance', cmd: 'node scripts/validate-provenance.js' },
];

const SKIP_DIVERGENCE = process.env.PUNICODEX_CI_SKIP_DIVERGENCE === '1';
const ACTIVE_SUITES = SKIP_DIVERGENCE ? SUITES.filter((s) => s.name !== 'Divergence Gate') : SUITES;

const results = [];
let totalPass = 0;
let _totalFail = 0;

console.log(`${C.bold}╔══════════════════════════════════════════════════╗${C.reset}`);
console.log(`${C.bold}║     PuniCodex — Master Test Runner              ║${C.reset}`);
console.log(`${C.bold}╚══════════════════════════════════════════════════╝${C.reset}`);

// Sharded runner: suites that write the working tree run alone; everything
// else runs in a small worker pool. Output is buffered per suite and printed
// as each completes; the final summary keeps the original declaration order.
const PARALLELISM = Number(process.env.PUNICODEX_TEST_PARALLELISM || 3);
const SERIAL_SUITES = new Set([
  'Divergence Gate', // runs npm run generate twice
  'Teacher Corpus Tests', // writes teacher staging files under data/authoritative/staging/
  'Generator Idempotency Tests', // runs generators that write artifacts
  'Blog Index Tests', // runs generate-blog-index.js (writes blog/index.html)
  'Herald Beacon Tests', // runs the beacon injector against the tree
  'Patterns Atlas Tests', // runs generate-patterns-page.js (writes patterns/*.html)
  'Trending Page Tests', // idempotency check rewrites trending/index.html
  'Everyday + Ink Tests', // idempotency checks rewrite everyday/index.html + data/ink-index.json
  // Dies silently under parallel load (no output before the runner marks it
  // failed); always green alone. Cheap suite — serializes for reliability.
  'Vendored Libs Tests',
  // Same parallel-phase flake: reads every temple patron page; green alone,
  // intermittently torn reads under load.
  'Patron Page Tests',
  // Reads every flagship temple page while generator suites rewrite them;
  // torn reads cause false Extended-tab failures.
  'Flagship Patterns Tests',
  // The two static-analysis gates scan the whole tree; running them in
  // parallel with tree-mutating suites makes them flag transient writes.
  'Format Check',
  'Biome Lint',
  // Login writes admin_sessions; golden-DB copies race in the parallel phase
  // (torn WAL state → "attempt to write a readonly database").
  'API v1 Integration Tests',
  // prepareTestDb copies the golden SQLite (incl. -shm/-wal); under parallel
  // load the copy can hit EBUSY/readonly races on Windows. Always green alone.
  'Admin Booking Routes',
  'Sponsorship Flow Tests',
  // Same prepareTestDb golden-copy race as the suites above (Windows).
  'Booking Publish/Pause Tests',
  'Account Booking Controls Tests',
  'Admin Creative Review Tests',
  // The sponsorship test wall — same prepareTestDb golden-copy race.
  'Sponsorship State Machine Tests',
  'Sponsorship Slot Invariant Tests',
  'Account Endpoint Contract Tests',
  'Change-Request Pipeline Tests',
  'Slots Payload Contract Tests',
  'Sponsorship Email Trigger Tests',
  // Same prepareTestDb golden-copy race (plus login writes admin_sessions).
  'Security Tab Tests',
  'Attack Simulation Tests',
  'Injection Extended Tests',
  'Authz Matrix Tests',
  'Session Attack Tests',
  'Abuse Economics Tests',
  'Security Telemetry Tests',
  // prepareTestDb isolation: golden DB copy can race under parallel load.
  'Analytics Anomaly Tests',
  'Analytics Quality Tests',
  'Analytics Funnels Tests',
  'Analytics Cohorts Tests',
  'Analytics LTV Tests',
  'Analytics Realtime Tests',
  'Analytics Rollups Tests',
  'Analytics Retention Tests',
  'Admin Analytics V2 Tests',
  // Stamps ?v= pins across tracked HTML (tree-writer).
  'Asset Version Tests',
  // Injects analytics beacon across tracked HTML (tree-writer).
  'Site Analytics Tests',
  // Writes index.html stats when they drift (tree-writer).
  'Hero Stats Tests',
  // 36 oracle Q&A calls against the golden DB; keep out of the parallel phase.
  'Oracle Eval Battery',
]);

function runSuiteCmd(suite) {
  return new Promise((resolve) => {
    const [cmd, ...args] = suite.cmd.split(' ');
    const child = execFile(
      cmd,
      args,
      {
        cwd: path.resolve(__dirname, '..'),
        timeout: suite.timeout || 30000,
        maxBuffer: 64 * 1024 * 1024,
        killSignal: 'SIGTERM',
        // npm is a .cmd shim on Windows — execFile can only spawn it via a shell.
        shell: suite.shell === true,
      },
      (error, stdout, stderr) => {
        resolve({ suite, ok: !error, output: `${stdout || ''}${stderr || ''}` });
      }
    );
    child.on('error', () => {});
  });
}

function printSuiteResult({ suite, ok, output }) {
  console.log(`\n${C.cyan}▸ ${suite.name}${C.reset}`);
  console.log(output.trimEnd());
  results.push({ name: suite.name, ok });
  if (!ok) _totalFail++;
  const match = output.match(/(\d+) assertions passed|All (\d+) tests passed/);
  if (match) {
    totalPass += parseInt(match[1] || match[2], 10);
  }
}

async function main() {
  // Serial suites run in declaration order at the very end, alone — but only
  // after every parallel suite has finished touching the tree.
  const serial = [];
  const parallel = [];
  for (const suite of ACTIVE_SUITES) {
    (SERIAL_SUITES.has(suite.name) ? serial : parallel).push(suite);
  }
  const queue = [...parallel];

  async function worker() {
    for (;;) {
      const suite = queue.shift();
      if (!suite) return;
      const result = await runSuiteCmd(suite);
      printSuiteResult(result);
    }
  }

  const workers = Array.from({ length: Math.max(1, PARALLELISM) }, () => worker());
  await Promise.all(workers);

  for (const suite of serial) {
    printSuiteResult(await runSuiteCmd(suite));
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`${C.bold}Results:${C.reset}`);
  // Print the summary in original declaration order, not completion order.
  const byName = new Map(results.map((r) => [r.name, r]));
  ACTIVE_SUITES.forEach((suite) => {
    const r = byName.get(suite.name) || { ok: false };
    const icon = r.ok ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
    console.log(`  ${icon} ${suite.name}`);
  });

  if (totalPass > 0) {
    console.log(
      `\n  ${C.dim}Total assertions passed:${C.reset} ${C.green}${totalPass.toLocaleString()}${C.reset}`
    );
  }

  const allOk = results.every((r) => r.ok);
  if (allOk) {
    console.log(`\n  ${C.green}✓ All suites passed${C.reset}`);
    process.exit(0);
  } else {
    console.log(`\n  ${C.red}✗ ${results.filter((r) => !r.ok).length} suite(s) failed${C.reset}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
