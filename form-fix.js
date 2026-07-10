// Načítá se před app.js a blokuje chybný anonymní reset listener,
// který v původní verzi spouštěl resetEntryForm() znovu po každém form.reset().
// Tím vznikala nekonečná smyčka: pole nešlo psát a editace se ihned vymazala.
const originalAddEventListener = EventTarget.prototype.addEventListener;

EventTarget.prototype.addEventListener = function (type, listener, options) {
  if (type === "reset" && this instanceof HTMLFormElement && this.id === "entry-form") {
    return;
  }
  return originalAddEventListener.call(this, type, listener, options);
};
