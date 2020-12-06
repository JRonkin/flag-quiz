const DEFAULT_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function shuffle(array, limit = array.length) {
  const maxIndex = Math.max(0, Math.min(parseInt(limit) || 0, array.length));

  for (i = 0; i < maxIndex; i++) {
    const index = Math.floor(Math.random() * (array.length - i)) + i;
    const temp = array[i];

    array[i] = array[index];
    array[index] = temp;
  }

  return array;
}

class App {
  static get PAGE_HOME() {
    return 0;
  }

  static get _CACHES() {
    return {};
  }

  static async _cacheResponse(cacheName, request, response) {
    if (window.caches) {
      await window.caches.open(cacheName).then(cache => cache.put(request, response));
    }
  }

  static async _initCaches() {
    if (window.caches) {
      const expectedCacheNamesSet = new Set(Object.values(this._CACHES));
      const cacheNames = await window.caches.keys();

      await Promise.all(cacheNames.map(async cacheName => {
        if (!expectedCacheNamesSet.has(cacheName)) {
          await caches.delete(cacheName);
        }
      }));
    }
  }

  static async _getCachedResponse(cacheName, request) {
    if (window.caches) {
      return await window.caches.open(cacheName).then(cache => cache.match(request));
    }
  }

  constructor(element) {
    this.element = element;

    this.init();
  }

  init() {
    for (const guessCountryButton of document.querySelectorAll('.js-home')) {
      guessCountryButton.addEventListener('click', () => this.showHomePage());
    }
  }

  showPage(num) {
    const pageNum = parseInt(num);

    if (!isNaN(pageNum)) {
      this.element.dataset.page = Math.max(0, pageNum);
    }
  }

  showHomePage() {
    this.showPage(this.constructor.PAGE_HOME);
  }
}

class FlagQuiz extends App {
  static get PAGE_GUESS_COUNTRY() {
    return 1;
  }

  static get PAGE_GUESS_FLAG() {
    return 2;
  }

  static get _CACHES() {
    return Object.assign(super._CACHES, {
      flags: 'flags-v1'
    });
  }

  static get _COUNTRIES_JSON_URL() {
    return 'https://raw.githubusercontent.com/hjnilsson/country-flags/master/countries.json';
  }

  static get _EXCLUDED_COUNTRIES() {
    return [
      'BV',     // Flag is the same as NO
      'BQ',     // Flag is the same as NL
      'GB-NIR', // Flag is the same as GB
      'GF',     // Flag is the same as FR
      'GP',     // Flag is the same as FR
      'HM',     // Flag is the same as AU
      'MF',     // Flag is the same as FR
      'MQ',     // Flag is the same as FR
      'NO',     // Flag is the same as FR
      'PM',     // Flag is the same as FR
      'RE',     // Flag is the same as FR
      'SH',     // Flag is the same as GB
      'SJ',     // Flag is the same as NO
      'UM',     // Flag is the same as US
      'YT'      // Flag is the same as FR
    ];
  }

  static _flagUrl(countryCode) {
    return `https://raw.githubusercontent.com/hjnilsson/country-flags/master/svg/${countryCode.toLowerCase()}.svg`;
  }

  static async _getCountries() {
    const countries = await fetch(this._COUNTRIES_JSON_URL).then(resp => resp.json());

    if (typeof countries != 'object') {
      throw new Error(`Country data from '${this._COUNTRIES_JSON_URL}' is formatted incorrectly`);
    }

    this._EXCLUDED_COUNTRIES.forEach(countryCode => delete countries[countryCode]);

    return countries;
  }

  static async _getFlagAltText(countryCode) {
    // TODO -- Good descriptions on this page: http://jmatchparser.sourceforge.net/factbook/mobile/flags2.html
    return '';
  }

  static async _getFlagImage(countryCode) {
    const url = this._flagUrl(countryCode);
    let response = await this._getCachedResponse(this._CACHES.flags, url);

    if (!response) {
      response = await fetch(url);

      if (response.status < 400) {
        this._cacheResponse(this._CACHES.flags, url, response.clone());
      } else {
        throw new Error(`Failed to fetch flag image for ${countryCode}. Response from ${url} was "${response.status}: ${response.statusText}"`);
      }
    }

    return 'data:image/svg+xml;base64,' + btoa(await response.text());
  }

  static _setFlagImage(img, countryCode) {
    img._countryCode = countryCode;
    img.src = DEFAULT_IMAGE;
    img.alt = '';

    this._getFlagImage(countryCode)
      .then(src => {
        if (img._countryCode == countryCode) {
          img.src = src;
        }
      });

    this._getFlagAltText(countryCode)
      .then(alt => {
        if (img._countryCode == countryCode) {
          img.alt = alt;
        }
      });
  }

  constructor(element) {
    super(element);

    this.countries = {};
    this.countryQueue = [];
    this.countryPool = [];

    this._loaded = new Promise((resolve, reject) => {
      this._resolveLoad = resolve;
      this._rejectLoad = reject;
    });
  }

  init() {
    super.init();

    for (const guessCountryButton of this.element.querySelectorAll('.js-guess-country')) {
      guessCountryButton.addEventListener('click', () => this.showGuessCountryPage());
    }

    for (const guessFlagButton of this.element.querySelectorAll('.js-guess-flag')) {
      guessFlagButton.addEventListener('click', () => this.showGuessFlagPage());
    }

    this.questionFlagEls = [...this.element.querySelectorAll('.js-question-flag')];
    this.answerCountryEls = [...this.element.querySelectorAll('.js-answer-country')];
    this.questionCountryEls = [...this.element.querySelectorAll('.js-question-country')];
    this.answerFlagEls = [...this.element.querySelectorAll('.js-answer-flag')];

    this.answerCountryEls.forEach(el => el.addEventListener('click', () => {
      if (el._isCorrectAnswer) {
        this.newCountryQuestion();
      } else {
        el.style.visibility = 'hidden';
      }
    }));

    this.answerFlagEls.forEach(el => {
      el.imgs = [...el.querySelectorAll('.js-answer-flag-img')];
      el.addEventListener('click', () => {
        if (el._isCorrectAnswer) {
          this.newFlagQuestion();
        } else {
          el.style.visibility = 'hidden';
        }
      });
    });

    this.load()
      .then(() => this.element.dataset.loaded = 'true')
      .catch(() => this.element.dataset.loaded = 'false');
  }

  async load() {
    try {
      this.countries = await this.constructor._getCountries();
      this.countryQueue = shuffle(Object.keys(this.countries));
      this.countryPool = this.countryQueue.splice(this.countryQueue.length / 2);
      await this._cacheAllFlags();
      this._resolveLoad();
    } catch (err) {
      this._rejectLoad(err);
    }
  }

  newCountryQuestion() {
    const countries = this._randomCountries(this.answerCountryEls.length);

    if (countries.length && countries.length == this.answerCountryEls.length) {
      const correctAnswer = Math.floor(Math.random() * countries.length);

      this.questionFlagEls.forEach(el => this.constructor._setFlagImage(el, countries[correctAnswer]));
      this.answerCountryEls.forEach((el, i) => {
        el.innerText = this.countries[countries[i]];
        el.style.visibility = '';
        el._isCorrectAnswer = i == correctAnswer;
      });
    }
  }

  newFlagQuestion() {
    const countries = this._randomCountries(this.answerFlagEls.length);

    if (countries.length && countries.length == this.answerFlagEls.length) {
      const correctAnswer = Math.floor(Math.random() * countries.length);

      this.questionCountryEls.forEach(el => el.innerText = this.countries[countries[correctAnswer]]);
      this.answerFlagEls.forEach((el, i) => {
        el.imgs.forEach(img => this.constructor._setFlagImage(img, countries[i]));
        el.style.visibility = '';
        el._isCorrectAnswer = i == correctAnswer;
      });
    }
  }

  async showGuessCountryPage() {
    await this.ready();
    this.newCountryQuestion();
    this.showPage(this.constructor.PAGE_GUESS_COUNTRY);
  }

  async showGuessFlagPage() {
    await this.ready();
    this.newFlagQuestion();
    this.showPage(this.constructor.PAGE_GUESS_FLAG);
  }

  async ready() {
    return await this._loaded;
  }

  async _cacheAllFlags() {
    if (window.caches) {
      const cache = await window.caches.open(this.constructor._CACHES.flags);

      await Promise.all(Object.keys(this.countries).map(async countryCode => {
        const url = this.constructor._flagUrl(countryCode);

        if (!(await cache.match(url))) {
          const response = await fetch(url);

          if (response.status < 400) {
            await cache.put(url, response);
          }
        }
      }));
    }
  }

  _randomCountries(num) {
    const numCountries = Math.max(0, parseInt(num) || 0);
    const countries = this.countryQueue.splice(0, numCountries);

    this.countryQueue.push(...shuffle(this.countryPool, numCountries).splice(0, numCountries));
    this.countryPool.push(...countries);

    return countries;
  }
}

const app = new FlagQuiz(document.getElementById('app'));
