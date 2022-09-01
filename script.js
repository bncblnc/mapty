'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const btnUndo = document.querySelector('.btn__undo');
const btnAll = document.querySelector('.btn__all');
const btnTopAll = document.querySelector('.btn__topall');
const btnRun = document.querySelector('.btn__run');
const btnCyc = document.querySelector('.btn__cyc');
const btnSort = document.querySelector('.btn__sort');
const inputSort = document.querySelector('.top__select');

class Workout {
  clicks = 0;

  constructor(coords, distance, duration, date = 0, id = 0) {
    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
    this.date = date !== 0 ? new Date(date) : new Date();
    this.id = id !== 0 ? id : (Date.now() + '').slice(-10);
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence, date, id) {
    super(coords, distance, duration, date, id);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain, date, id) {
    super(coords, distance, duration, date, id);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  marker = [];
  trash = NaN;
  marker = {};
  edit = { lat: NaN, lng: NaN };
  sorted = true;
  optionDisplay = 'all';
  coordsList = [];

  constructor() {
    this._getPosition();
    this._getLocalStorage();
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener(
      'click',
      this._clickedWorkout.bind(this)
    );
    btnUndo.addEventListener('click', this._undo.bind(this));
    btnAll.addEventListener('click', this._deleteAll.bind(this));
    inputSort.addEventListener('change', this._sort.bind(this));
    btnSort.addEventListener('click', this._reverseSort.bind(this));
    btnRun.addEventListener('click', this._onlyRun.bind(this));
    btnCyc.addEventListener('click', this._onlyCyc.bind(this));
    btnTopAll.addEventListener('click', this._allWorks.bind(this));
  }

  _allWorks() {
    this.optionDisplay = 'all';
    const workoutData = document.querySelectorAll('.workout');
    workoutData.forEach(function (work) {
      if (work.classList.contains('workout--hidden'))
        work.classList.remove('workout--hidden');
    });

    this.#workouts.forEach(work => this.marker[work.id].openPopup());
    this._sort();
  }

  _onlyRun() {
    this._typeWorkouts('running');
  }

  _onlyCyc() {
    this._typeWorkouts('cycling');
  }

  _typeWorkouts(type) {
    this.optionDisplay = type;
    let workoutData = document.querySelectorAll('.workout');

    workoutData.forEach(work =>
      !work.classList.contains(`workout--${type}`)
        ? work.classList.add('workout--hidden')
        : work.classList.remove('workout--hidden')
    );

    this.#workouts.forEach(work =>
      work.type === this.optionDisplay
        ? this.marker[work.id].openPopup()
        : this.marker[work.id].closePopup()
    );

    this._sort();
  }

  _cleanWorkouts() {
    const workoutData = document.querySelectorAll('.workout');
    workoutData.forEach(data => data.remove());
  }
  _sort() {
    this._cleanWorkouts();
    let workouts = [...this.#workouts];

    let workSorted = this.sorted
      ? workouts.sort((a, b) => a[inputSort.value] - b[inputSort.value])
      : workouts.sort((a, b) => b[inputSort.value] - a[inputSort.value]);

    workSorted.forEach(this._displaySorted.bind(this));
  }

  _displaySorted(workout) {
    if (this.optionDisplay === 'all') this._renderWorkout(workout);
    if (workout.type === this.optionDisplay) this._renderWorkout(workout);
  }

  _reverseSort() {
    this.sorted = !this.sorted;
    this._sort();
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
    }
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot//{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // prettier-ignore
    inputCadence.value = inputDistance.value = inputDuration.value = inputElevation.value = '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _validInputs(type, dist, dur, value) {
    this._cleanInvalids();
    const validNumber = inp => Number.isFinite(inp) && inp > 0;

    let inputs = {
      distance: validNumber(dist) ? dist : false,
      duration: validNumber(dur) ? dur : false,
    };
    if (type === 'running') inputs.cadence = validNumber(value) ? value : false;
    if (type === 'cycling')
      inputs.elevation = Number.isFinite(value) ? value : false;

    let valid = true;
    let invalids = [];

    Object.entries(inputs).forEach(function ([key, input]) {
      if (!input) {
        valid = false;
        invalids.push(key);
      }
    });

    if (valid) return valid;

    if (invalids.includes('distance'))
      inputDistance.classList.add('form__invalid');
    if (invalids.includes('duration'))
      inputDuration.classList.add('form__invalid');
    if (invalids.includes('cadence'))
      inputCadence.classList.add('form__invalid');
    if (invalids.includes('elevation'))
      inputElevation.classList.add('form__invalid');
  }

  _cleanInvalids() {
    inputDistance.classList.remove('form__invalid');
    inputDuration.classList.remove('form__invalid');
    inputCadence.classList.remove('form__invalid');
    inputElevation.classList.remove('form__invalid');
  }

  _newWorkout(e) {
    e.preventDefault();

    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;

    let lat;
    let lng;
    if (this.edit['lat']) {
      lat = this.edit['lat'];
      lng = this.edit['lng'];
    } else {
      lat = this.#mapEvent.latlng.lat;
      lng = this.#mapEvent.latlng.lng;
    }

    let workout;

    if (type === 'running') {
      const cadence = +inputCadence.value;

      if (!this._validInputs(type, distance, duration, cadence)) return;

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (!this._validInputs(type, distance, duration, elevation)) return;

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    this.#workouts.push(workout);

    this._renderWorkoutMarker(workout);
    this._renderWorkout(workout);
    this._hideForm();
    this._sort();

    this._setLocalStorage();
    this.edit['lat'] = NaN;
    this.edit['lng'] = NaN;
  }

  _renderWorkoutMarker(workout) {
    this.marker[workout.id] = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
    <div class="workout__options"> 
    <button class="btn__marker workout__btn"><img  src="marker.png" alt="Marker" > </button> 
      <button class="btn__edit workout__btn"><img  src="edit.png" alt="Edit" > </button>
      <button class="btn__delete workout__btn"><img  src="delete.png" alt="Delete"> </button>
    </div>
    <h2 class="workout__title">${workout.description}</h2>
 
      <div class="workout__details">
        <span class="workout__icon">${
          workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
        }</span>
        <span class="workout__value">${workout.distance}</span>
        <span class="workout__unit">km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value">${workout.duration}</span>
        <span class="workout__unit">min</span>
      </div>`;

    if (workout.type === 'running')
      html += ` 
      <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.pace.toFixed(1)}</span>
        <span class="workout__unit">min/km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">🦶🏼</span>
        <span class="workout__value">${workout.cadence}</span>
        <span class="workout__unit">spm</span>
      </div>
    </li>`;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>`;

    form.insertAdjacentHTML('afterend', html);
  }

  _clickedWorkout(e) {
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    const opMarker = e.target.closest('.btn__marker');
    if (opMarker) this._moveToPopup(workout);

    const opDelete = e.target.closest('.btn__delete');
    if (opDelete) this._deleteWorkout(workoutEl, workout);

    const opEdit = e.target.closest('.btn__edit');
    if (opEdit) this._editWorkout(workoutEl, workout);
  }

  _editWorkout(e, el) {
    this.edit['lat'] = el.coords[0];
    this.edit['lng'] = el.coords[1];

    if (inputType.value !== el.type) this._toggleElevationField();
    inputType.value = el.type;
    inputDistance.value = el.distance;
    inputDuration.value = el.duration;
    if (el.type === 'running') inputCadence.value = el.cadence;
    if (el.type === 'cycling') inputElevation.value = el.elevationGain;

    this._showForm();
    this._deleteWorkout(e, el);
    this._sort();
  }

  _deleteWorkout(e, el) {
    this.trash = [];
    this.trash.push(el);
    this.#workouts = this.#workouts.filter(work => work.id != el.id);

    e.remove();
    this.#map.removeLayer(this.marker[el.id]);
    delete this.marker[el.id];

    this._setLocalStorage();
  }

  _deleteAll() {
    this.trash = [];
    this.#workouts.forEach(this._delAllTrash.bind(this));
    this.#workouts = [];

    this._cleanWorkouts();

    this._setLocalStorage();
  }

  _delAllTrash(work) {
    this.trash.push(work);
    this.#map.removeLayer(this.marker[work.id]);
  }

  _undo() {
    if (!this.trash) return;

    this.trash.forEach(this._backTrash.bind(this));
    this.trash = NaN;

    this._sort();

    this._setLocalStorage();
  }

  _backTrash(work, i) {
    this.#workouts.push(work);
    this._renderWorkout(work);
    this._renderWorkoutMarker(work);
  }

  _moveToPopup(workout) {
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: { duration: 1 },
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    let workout = [];
    data.forEach(function (work) {
      if (work.type === 'running') {
        workout.push(
          new Running(
            work.coords,
            work.distance,
            work.duration,
            work.cadence,
            work.date,
            work.id
          )
        );
      }

      if (work.type === 'cycling') {
        workout.push(
          new Cycling(
            work.coords,
            work.distance,
            work.duration,
            work.elevationGain,
            work.date,
            work.id
          )
        );
      }
    });

    this.#workouts = workout;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });

    this._sort();
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();


