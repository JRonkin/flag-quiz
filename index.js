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

  constructor(element) {
    this.element = element;

    this.init();
  }

  init() {
    this.showHomePage = this.showPage.bind(this, this.constructor.PAGE_HOME);
  }

  showPage(num) {
    const pageNum = parseInt(num);

    if (!isNaN(pageNum)) {
      this.element.dataset.page = Math.max(0, pageNum);
    }
  }
}

class FlagQuiz extends App {
  static get PAGE_GUESS_COUNTRY() {
    return 1;
  }

  static get PAGE_GUESS_FLAG() {
    return 2;
  }

  static get _COUNTRIES_JSON_URL() {
    return 'https://raw.githubusercontent.com/hjnilsson/country-flags/master/countries.json';
  }

  static get _EXCLUDED_COUNTRIES() {
    return [
      'GB-NIR' // Excluded because the flag is the same as GB
    ];
  }

  constructor(element, offline = false) {
    super(element);

    this.countries = {};
    this.offline = offline;

    this._loaded = new Promise((resolve, reject) => {
      this._resolveLoad = resolve;
      this._rejectLoad = reject;
    });
  }

  cacheCountries() {
    // TODO
  }

  init() {
    super.init();

    this.showGuessCountryPage = () => {
      this.newCountryQuestion();
      this.showPage(this.constructor.PAGE_GUESS_COUNTRY);
    };
    this.showGuessFlagPage = () => {
      this.newFlagQuestion();
      this.showPage(this.constructor.PAGE_GUESS_FLAG);
    };

    for (const guessCountryButton of this.element.querySelectorAll('.js-guess-country')) {
      guessCountryButton.addEventListener('click', this.showGuessCountryPage);
    }

    for (const guessFlagButton of this.element.querySelectorAll('.js-guess-flag')) {
      guessFlagButton.addEventListener('click', this.showGuessFlagPage);
    }

    this.questionFlagEls = [...this.element.querySelectorAll('.js-question-flag')];
    this.answerCountryEls = [...this.element.querySelectorAll('.js-answer-country')];
    this.questionCountryEls = [...this.element.querySelectorAll('.js-question-country')];
    this.answerFlagEls = [...this.element.querySelectorAll('.js-answer-flag')];

    this.answerCountryEls.forEach(el => el.addEventListener('click', () => {
      if (el.isCorrectAnswer) {
        this.newCountryQuestion();
      } else {
        el.style.visibility = 'hidden';
      }
    }));

    this.answerFlagEls.forEach(el => {
      el.imgs = [...el.querySelectorAll('.js-answer-flag-img')];
      el.addEventListener('click', () => {
        if (el.isCorrectAnswer) {
          this.newFlagQuestion();
        } else {
          el.style.visibility = 'hidden';
        }
      });
    });

    this.load().then(() => this.element.dataset.loaded = 'true');
  }

  async load() {
    try {
      this.countries = await this._getCountries();
      this._resolveLoad();
    } catch (err) {
      this._rejectLoad(err);
    }
  }

  newCountryQuestion() {
    const countries = this._randomCountries(this.answerCountryEls.length);

    if (countries.length && countries.length == this.answerCountryEls.length) {
      const correctAnswer = Math.floor(Math.random() * countries.length);

      this.questionFlagEls.forEach(el => this._setFlagImage(el, countries[correctAnswer]));
      this.answerCountryEls.forEach((el, i) => {
        el.innerText = this.countries[countries[i]];
        el.style.visibility = '';
        el.isCorrectAnswer = i == correctAnswer;
      });
    }
  }

  newFlagQuestion() {
    const countries = this._randomCountries(this.answerFlagEls.length);

    if (countries.length && countries.length == this.answerFlagEls.length) {
      const correctAnswer = Math.floor(Math.random() * countries.length);

      this.questionCountryEls.forEach(el => el.innerText = this.countries[countries[correctAnswer]]);
      this.answerFlagEls.forEach((el, i) => {
        el.imgs.forEach(img => this._setFlagImage(img, countries[i]));
        el.style.visibility = '';
        el.isCorrectAnswer = i == correctAnswer;
      });
    }
  }

  async ready() {
    return await this._loaded;
  }

  _getFlagSvg(countryCode) {
    if (this.offline) {
      // TODO
      throw new Error('Offline mode is not yet supported');
    } else {
      return `https://raw.githubusercontent.com/hjnilsson/country-flags/master/svg/${countryCode.toLowerCase()}.svg`;
    }
  }

  async _getCountries() {
    if (this.offline) {
      // TODO
      throw new Error('Offline mode is not yet supported');
    } else {
      const countries = await fetch(this.constructor._COUNTRIES_JSON_URL).then(resp => resp.json());

      if (typeof countries != 'object') {
        throw new Error(`Country data from '${this.constructor._COUNTRIES_JSON_URL}' is formatted incorrectly`);
      }

      this.constructor._EXCLUDED_COUNTRIES.forEach(countryCode => delete countries[countryCode]);

      return countries;
    }
  }

  _randomCountries(num) {
    const numCountries = Math.max(0, parseInt(num) || 0);

    return shuffle(Object.keys(this.countries), numCountries).slice(0, numCountries);
  }

  _setFlagImage(img, countryCode) {
    img.src = this._getFlagSvg(countryCode, this.offline);
    // TODO: flag alt text
  }
}

new FlagQuiz(document.getElementById('app'));
