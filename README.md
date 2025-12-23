# k6 Performance Testing Boilerplate

![k6](https://img.shields.io/badge/-k6-7D64FF?style=flat-square&logo=k6&logoColor=white)
![JavaScript](https://img.shields.io/badge/-JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/-Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![Git](https://img.shields.io/badge/-Git-F05032?style=flat-square&logo=git&logoColor=white)
![GitHub](https://img.shields.io/badge/-GitHub-181717?style=flat-square&logo=github&logoColor=white)

[English](#english) | [Polski](#polski)

## English

Ready-to-use k6 performance testing boilerplate with best practices and examples.

### Table of contents

- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Load Profiles](#load-profiles)
- [Running Tests](#running-tests)
- [Writing Your Own Tests](#writing-your-own-tests)
- [SLO (Service Level Objectives)](#slo-service-level-objectives)
- [Best Practices](#best-practices)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)
- [k6 Documentation](#k6-documentation)

---

### Quick Start

#### 1. Install k6

```bash
# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# macOS
brew install k6

# Windows
choco install k6
```

#### 2. Configuration

Edit `config/env.js`:

```javascript
export const HOSTS = {
  PROD: "https://api.your-domain.com",
  DEV: "https://api-dev.your-domain.com",
};

export const TOKENS = {
  USER: "your-user-token",
  ADMIN: "your-admin-token",
};
```

#### 3. Run tests

```bash
# Grant execute permissions
chmod +x *.sh

# Run all tests with default profile (LIGHT)
./run.sh

# Or directly with k6
k6 run run-all.js
```

---

### Project Structure

```
k6-test-boilerplate/
├── config/
│   ├── env.js              # Environment config, tokens, profiles
│   └── slo.js              # SLO definitions
│
├── helpers/
│   └── common.js           # Shared helper functions
│
├── utils/
│   ├── checks.js           # Response validation helpers
│   └── http-utils.js       # HTTP wrappers with error handling
│
├── tests/
│   └── example/
│       ├── get-endpoint.js     # GET test example
│       ├── post-endpoint.js    # POST test example
│       └── crud-operations.js  # Full CRUD flow example
│
├── run-all.js              # Orchestrates all scenarios
├── run.sh                  # Main runner script
├── sequential-tests.sh     # Sequential execution
├── parallel-tests.sh       # Parallel execution
├── package.json
└── README.md
```

---

### Configuration

#### Environment variables

Tests can be configured via environment variables:

| Variable | Description | Values | Default |
|---------|-------------|--------|---------|
| `PROFILE` | Load profile | SMOKE, LIGHT, MEDIUM, HEAVY | LIGHT |
| `HOST` | Target environment | DEV, STAGING, PROD | DEV |
| `TOKEN_USER` | User token | string | from env.js |
| `TOKEN_ADMIN` | Admin token | string | from env.js |

#### Example

```bash
k6 run -e PROFILE=MEDIUM -e HOST=PROD run-all.js
```

---

### Load Profiles

| Profile | VUs | Duration | Use case |
|---------|-----|----------|----------|
| SMOKE | 1 | 30s | Quick sanity check |
| LIGHT | 10 | 60s | Daily CI/CD, quick validation |
| MEDIUM | 30 | 5m | Weekly regression, pre-release |
| HEAVY | 100 | 10m | Stress testing, capacity planning |

---

### Running Tests

#### Via run.sh

```bash
# All tests with LIGHT profile
./run.sh

# Specific profile
./run.sh -p MEDIUM

# Specific environment
./run.sh -h PROD

# Single test
./run.sh -t get-endpoint

# Combination
./run.sh -h PROD -p HEAVY -t crud
```

#### Via npm scripts

```bash
npm run test:light
npm run test:medium
npm run test:prod:heavy
```

#### Directly with k6

```bash
# Single test
k6 run tests/example/get-endpoint.js

# With profile
k6 run -e PROFILE=MEDIUM tests/example/get-endpoint.js

# Output to JSON
k6 run --out json=results.json run-all.js
```

---

### Writing Your Own Tests

#### 1. Create a new test file

```javascript
// tests/my-feature/my-endpoint.js

import { check, sleep } from 'k6';
import { get, post } from '../../utils/http-utils.js';
import { checkStatus, checkListResponse } from '../../utils/checks.js';
import { thinkTime, logError } from '../../helpers/common.js';
import { getProfile } from '../../config/env.js';
import { generateThresholds, ENDPOINT_SLO } from '../../config/slo.js';

// Test options
const profile = getProfile();

export const options = {
  ...profile,
  thresholds: generateThresholds(ENDPOINT_SLO.products.list),
};

// Setup (optional)
export function setup() {
  console.log('Preparing test data...');
  return { /* data for tests */ };
}

// Main test function
export default function(data) {
  const res = get('/my-endpoint', 'USER', 'my-test');

  checkStatus(res);

  if (res.status === 200) {
    checkListResponse(res, 'my-endpoint');
  }

  sleep(thinkTime());
}

// Teardown (optional)
export function teardown(data) {
  console.log('Cleaning up...');
}
```

#### 2. Add to run-all.js (optional)

```javascript
// Import
import { myEndpointTest } from './tests/my-feature/my-endpoint.js';

// Add scenario
export const options = {
  scenarios: {
    // ... existing scenarios
    my_endpoint: {
      exec: 'myEndpointScenario',
      executor: 'constant-vus',
      vus: Math.ceil(vus * 0.1),
      duration: duration,
      tags: { test_type: 'my-endpoint' },
    },
  },
};

// Add scenario function
export function myEndpointScenario() {
  myEndpointTest();
}
```

---

### SLO (Service Level Objectives)

#### Defining SLO

In `config/slo.js`:

```javascript
export const ENDPOINT_SLO = {
  myFeature: {
    list: {
      p95: 300,       // 95% of requests < 300ms
      p99: 800,       // 99% of requests < 800ms
      errorRate: 0.01 // max 1% errors
    },
    create: {
      p95: 1000,
      p99: 2000,
      errorRate: 0.02
    }
  }
};
```

#### Usage in tests

```javascript
import { generateThresholds, ENDPOINT_SLO } from '../config/slo.js';

export const options = {
  thresholds: generateThresholds(ENDPOINT_SLO.myFeature.list),
};
```

---

### Best Practices

#### 1. Test structure

- **One file = one concern** for easy maintenance
- **Domain folders** to group tests logically
- **Reusable helpers** to reduce duplication

#### 2. Response validation

```javascript
// Always check status
checkStatus(res);

// Validate response structure
if (res.status === 200) {
  try {
    const data = res.json();
    check(data, {
      'has items': (d) => Array.isArray(d.items),
      'items not empty': (d) => d.items.length > 0,
    });
  } catch (e) {
    logError('my-test', `JSON parsing failed: ${e.message}`);
  }
}
```

#### 3. Logging

```javascript
// Log only errors
if (res.status !== 200) {
  logError('my-test', `Failed with status ${res.status}`);
}

// Avoid logging every request
```

#### 4. Think time

```javascript
// Realistic delays between requests
sleep(thinkTime()); // 1-3 seconds

// Longer for write operations
sleep(thinkTime() * 2);
```

#### 5. Load profiles

```javascript
// Always use profiles instead of hardcoded values
const profile = getProfile();

export const options = {
  ...profile,
  thresholds: { /* ... */ },
};
```

---

### CI/CD Integration

#### GitLab CI

```yaml
performance-test:
  stage: test
  image: grafana/k6:latest
  script:
    - k6 run -e PROFILE=LIGHT run-all.js
  artifacts:
    reports:
      junit: results/junit.xml
  rules:
    - if: '$CI_COMMIT_BRANCH == "develop"'
```

#### GitHub Actions

```yaml
- name: Run k6 tests
  uses: grafana/k6-action@v0.3.1
  with:
    filename: run-all.js
    flags: -e PROFILE=LIGHT
```

---

### Troubleshooting

#### Test does not start

```bash
# Check if k6 is installed
k6 version

# Check CLI usage
k6 run --help
```

#### Token issues

```bash
# Use environment variables
export TOKEN_USER="your-token"
k6 run -e TOKEN_USER=$TOKEN_USER run-all.js
```

#### Timeout

```javascript
// Increase timeout in options
export const options = {
  httpTimeout: '120s',
};
```

---

### k6 Documentation

- [Official documentation](https://grafana.com/docs/k6/latest/)
- [JavaScript API](https://grafana.com/docs/k6/latest/javascript-api/)
- [Examples](https://github.com/grafana/k6-learn)

---

**Version:** 1.0.0
**Author:** dar-kow
**License:** MIT

---

## Polski

Gotowy do użycia szablon testów wydajnościowych k6 z best practices i przykładami.

### Spis treści

- [Szybki start](#szybki-start)
- [Struktura projektu](#struktura-projektu)
- [Konfiguracja](#konfiguracja)
- [Profile obciążenia](#profile-obciazenia)
- [Uruchamianie testów](#uruchamianie-testow)
- [Pisanie własnych testów](#pisanie-wlasnych-testow)
- [SLO (Service Level Objectives)](#slo-service-level-objectives)
- [Best Practices](#best-practices)
- [Integracja CI/CD](#integracja-cicd)
- [Troubleshooting](#troubleshooting)
- [Dokumentacja k6](#k6-documentation)

---

### Szybki start

#### 1. Instalacja k6

```bash
# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# macOS
brew install k6

# Windows
choco install k6
```

#### 2. Konfiguracja

Edytuj plik `config/env.js`:

```javascript
export const HOSTS = {
  PROD: "https://api.twoja-domena.com",
  DEV: "https://api-dev.twoja-domena.com",
};

export const TOKENS = {
  USER: "twój-token-użytkownika",
  ADMIN: "twój-token-admina",
};
```

#### 3. Uruchomienie testów

```bash
# Nadaj uprawnienia do skryptów
chmod +x *.sh

# Uruchom wszystkie testy z domyślnym profilem (LIGHT)
./run.sh

# Lub bezpośrednio przez k6
k6 run run-all.js
```

---

### Struktura projektu

```
k6-test-boilerplate/
├── config/
│   ├── env.js              # Konfiguracja środowisk, tokeny, profile
│   └── slo.js              # Definicje SLO (Service Level Objectives)
│
├── helpers/
│   └── common.js           # Wspólne funkcje pomocnicze
│
├── utils/
│   ├── checks.js           # Funkcje walidacji odpowiedzi
│   └── http-utils.js       # Wrappery HTTP z obsługą błędów
│
├── tests/
│   └── example/
│       ├── get-endpoint.js     # Przykład testu GET
│       ├── post-endpoint.js    # Przykład testu POST
│       └── crud-operations.js  # Przykład pełnego CRUD flow
│
├── run-all.js              # Orkiestracja wszystkich scenariuszy
├── run.sh                  # Główny skrypt uruchamiający
├── sequential-tests.sh     # Testy sekwencyjne
├── parallel-tests.sh       # Testy równoległe
├── package.json
└── README.md
```

---

### Konfiguracja

#### Zmienne środowiskowe

Testy można konfigurować przez zmienne środowiskowe:

| Zmienna | Opis | Wartości | Domyślna |
|---------|------|----------|----------|
| `PROFILE` | Profil obciążenia | SMOKE, LIGHT, MEDIUM, HEAVY | LIGHT |
| `HOST` | Środowisko docelowe | DEV, STAGING, PROD | DEV |
| `TOKEN_USER` | Token użytkownika | string | z env.js |
| `TOKEN_ADMIN` | Token admina | string | z env.js |

#### Przykład użycia

```bash
k6 run -e PROFILE=MEDIUM -e HOST=PROD run-all.js
```

---

### Profile obciążenia

| Profil | VUs | Czas | Zastosowanie |
|--------|-----|------|--------------|
| SMOKE | 1 | 30s | Szybki sanity check |
| LIGHT | 10 | 60s | Daily CI/CD, quick validation |
| MEDIUM | 30 | 5m | Weekly regression, pre-release |
| HEAVY | 100 | 10m | Stress testing, capacity planning |

---

### Uruchamianie testów

#### Przez skrypt run.sh

```bash
# Wszystkie testy z profilem LIGHT
./run.sh

# Określony profil
./run.sh -p MEDIUM

# Określone środowisko
./run.sh -h PROD

# Pojedynczy test
./run.sh -t get-endpoint

# Kombinacja
./run.sh -h PROD -p HEAVY -t crud
```

#### Przez npm scripts

```bash
npm run test:light
npm run test:medium
npm run test:prod:heavy
```

#### Bezpośrednio przez k6

```bash
# Pojedynczy test
k6 run tests/example/get-endpoint.js

# Z profilem
k6 run -e PROFILE=MEDIUM tests/example/get-endpoint.js

# Z output do JSON
k6 run --out json=results.json run-all.js
```

---

### Pisanie własnych testów

#### 1. Utwórz nowy plik testowy

```javascript
// tests/my-feature/my-endpoint.js

import { check, sleep } from 'k6';
import { get, post } from '../../utils/http-utils.js';
import { checkStatus, checkListResponse } from '../../utils/checks.js';
import { thinkTime, logError } from '../../helpers/common.js';
import { getProfile } from '../../config/env.js';
import { generateThresholds, ENDPOINT_SLO } from '../../config/slo.js';

// Opcje testu
const profile = getProfile();

export const options = {
  ...profile,
  thresholds: generateThresholds(ENDPOINT_SLO.products.list),
};

// Setup (opcjonalny)
export function setup() {
  console.log('Przygotowanie danych testowych...');
  return { /* dane dla testów */ };
}

// Główna funkcja testowa
export default function(data) {
  const res = get('/my-endpoint', 'USER', 'my-test');

  checkStatus(res);

  if (res.status === 200) {
    checkListResponse(res, 'my-endpoint');
  }

  sleep(thinkTime());
}

// Teardown (opcjonalny)
export function teardown(data) {
  console.log('Czyszczenie...');
}
```

#### 2. Dodaj do run-all.js (opcjonalnie)

```javascript
// Import
import { myEndpointTest } from './tests/my-feature/my-endpoint.js';

// Dodaj scenario
export const options = {
  scenarios: {
    // ... istniejące scenariusze
    my_endpoint: {
      exec: 'myEndpointScenario',
      executor: 'constant-vus',
      vus: Math.ceil(vus * 0.1),
      duration: duration,
      tags: { test_type: 'my-endpoint' },
    },
  },
};

// Dodaj funkcję scenariusza
export function myEndpointScenario() {
  myEndpointTest();
}
```

---

### SLO (Service Level Objectives)

#### Definiowanie SLO

W pliku `config/slo.js`:

```javascript
export const ENDPOINT_SLO = {
  myFeature: {
    list: {
      p95: 300,       // 95% requestów < 300ms
      p99: 800,       // 99% requestów < 800ms
      errorRate: 0.01 // max 1% błędów
    },
    create: {
      p95: 1000,
      p99: 2000,
      errorRate: 0.02
    }
  }
};
```

#### Używanie w testach

```javascript
import { generateThresholds, ENDPOINT_SLO } from '../config/slo.js';

export const options = {
  thresholds: generateThresholds(ENDPOINT_SLO.myFeature.list),
};
```

---

### Best Practices

#### 1. Struktura testów

- **Jeden plik = jeden concern** - łatwy maintenance
- **Domain folders** - grupuj testy logicznie
- **Reusable helpers** - redukcja duplikacji o 40-60%

#### 2. Walidacja odpowiedzi

```javascript
// Zawsze sprawdzaj status
checkStatus(res);

// Waliduj strukturę odpowiedzi
if (res.status === 200) {
  try {
    const data = res.json();
    check(data, {
      'has items': (d) => Array.isArray(d.items),
      'items not empty': (d) => d.items.length > 0,
    });
  } catch (e) {
    logError('my-test', `JSON parsing failed: ${e.message}`);
  }
}
```

#### 3. Logowanie

```javascript
// Loguj tylko błędy
if (res.status !== 200) {
  logError('my-test', `Failed with status ${res.status}`);
}

// Nie loguj każdego requestu - zanieczyszcza output
```

#### 4. Think time

```javascript
// Realistyczne opóźnienia między requestami
sleep(thinkTime()); // 1-3 sekundy

// Dłuższe dla operacji zapisu
sleep(thinkTime() * 2);
```

#### 5. Profile obciążenia

```javascript
// Zawsze używaj profili zamiast hardcoded wartości
const profile = getProfile();

export const options = {
  ...profile,
  thresholds: { /* ... */ },
};
```

---

### Integracja CI/CD

#### GitLab CI

```yaml
performance-test:
  stage: test
  image: grafana/k6:latest
  script:
    - k6 run -e PROFILE=LIGHT run-all.js
  artifacts:
    reports:
      junit: results/junit.xml
  rules:
    - if: '$CI_COMMIT_BRANCH == "develop"'
```

#### GitHub Actions

```yaml
- name: Run k6 tests
  uses: grafana/k6-action@v0.3.1
  with:
    filename: run-all.js
    flags: -e PROFILE=LIGHT
```

---

### Troubleshooting

#### Test się nie uruchamia

```bash
# Sprawdź czy k6 jest zainstalowane
k6 version

# Sprawdź składnię
k6 run --help
```

#### Problemy z tokenami

```bash
# Użyj zmiennych środowiskowych
export TOKEN_USER="your-token"
k6 run -e TOKEN_USER=$TOKEN_USER run-all.js
```

#### Timeout

```javascript
// Zwiększ timeout w opcjach
export const options = {
  httpTimeout: '120s',
};
```

---

### Dokumentacja k6

- [Oficjalna dokumentacja](https://grafana.com/docs/k6/latest/)
- [JavaScript API](https://grafana.com/docs/k6/latest/javascript-api/)
- [Przykłady](https://github.com/grafana/k6-learn)

---

**Wersja:** 1.0.0
**Autor:** dar-kow
**Licencja:** MIT
