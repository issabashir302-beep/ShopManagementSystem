const SETTING_KEY='shopwise.pos.sounds'
export const posSoundsEnabled=()=>localStorage.getItem(SETTING_KEY)!=='off'
export const setPosSoundsEnabled=enabled=>localStorage.setItem(SETTING_KEY,enabled?'on':'off')
function tone(frequency,duration,volume){if(!posSoundsEnabled())return;try{const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;const context=new Context(),oscillator=context.createOscillator(),gain=context.createGain();oscillator.frequency.value=frequency;gain.gain.setValueAtTime(volume,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+duration);oscillator.connect(gain).connect(context.destination);oscillator.start();oscillator.stop(context.currentTime+duration);oscillator.addEventListener('ended',()=>context.close())}catch{/* feedback cannot block checkout */}}
export const playItemAdded=()=>tone(660,.06,.025)
export const playSaleComplete=()=>{tone(660,.12,.05);setTimeout(()=>tone(880,.18,.05),100)}
