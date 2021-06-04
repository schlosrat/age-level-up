// @ts-check

import settings, {CONFIG} from './settings.js';
import {i18n} from './ui.js';
// import getNewHP from './getNewHP.js';

const DELAY = 400;

let levelUpDisplayed = false;
let dialog, timer, KeyBinding;

// /**
//  * Extend Dialog class to force focus on the input
//  */
// class levelUpDialog extends Dialog {
//   activateListeners(html) {
//     super.activateListeners(html);

//     // Focus the input
//     html.find('#level-up-input').focus();

//     // Add a class to dialog-buttons to be able to style them without breaking other stuff :/
//     html.addClass('level-up');
//   }
// }

/**
 * Apply damage, use the Actor5e formula
 *
 * @param {HTMLElement} html The html element
 * @param {boolean} isDamage Is the amount a damage? false if it's healing
 * @param {boolean} isTargeted Is it a targeted token?
 * @returns {Promise<Entity|Entity[]>}
 */
const applyDamage = async (html, isDamage, isTargeted) => {
  const value = html.find('input[type=number]').val();
  const damage = isDamage ? Number(value) : Number(value) * -1;

  const tokens = isTargeted
    ? Array.from(game.user.targets)
    : canvas.tokens.controlled;


  const promises = tokens.map(({actor}) => {
    // Handle temp hp if any
    const data = actor.data.data;
    const hp = getProperty(data, CONFIG.HITPOINTS_ATTRIBUTE);
    const max = getProperty(data, CONFIG.MAX_HITPOINTS_ATTRIBUTE);
    const temp = getProperty(data, CONFIG.TEMP_HITPOINTS_ATTRIBUTE);

    // Handle damage mitigation if any
    const mit1 = getProperty(data, CONFIG.MITIGATION_ATTRIBUTE_1);
    const mit2 = getProperty(data, CONFIG.MITIGATION_ATTRIBUTE_2);
    let dapplied = damage;
    if (damage > 0) {
      let mit = 0;
      if (mit1 != undefined) {
        mit = mit + mit1;
        // ui.notifications.notify("Primary Mitigation: " + CONFIG.MITIGATION_ATTRIBUTE_1 + " = " + mit1)
      }
      if (mit2 != undefined) {
        mit = mit + mit2;
        //ui.notifications.notify("Secondary Mitigation: " + CONFIG.MITIGATION_ATTRIBUTE_2 + " = " + mit2)
      }
      // ui.notifications.notify("Total Mitigation applied: " + mit)
      dapplied = Math.max(damage - mit, 0);
    }

    let anounceGM = '';
    let anouncePlayer = '';
    if (dapplied > 1) {
      anouncePlayer = CONFIG.OUCH;
      anounceGM = dapplied + " " + CONFIG.DAMAGE_POINTS;
    }
    if (dapplied === 1) {
      anouncePlayer = CONFIG.OUCH;
      anounceGM = CONFIG.DAMAGE_POINT;
    }
    if (dapplied === 0) {
      anouncePlayer = CONFIG.MEH;
      anounceGM = anouncePlayer;
    }
    if (dapplied < 0) {
      anouncePlayer = CONFIG.TY;
      if (hp < max) {
        if ((dapplied === -1) || ((max - hp) === 1)) {
          anounceGM = CONFIG.HEALING_POINT;
        } else {
          anounceGM = Math.min(-dapplied, max - hp) + " " + CONFIG.HEALING_POINTS;
        }
      } else {
        anouncePlayer = CONFIG.MEH;
        anounceGM = anouncePlayer;
      }
    }

    ChatMessage.create({content: anouncePlayer, speaker: ChatMessage.getSpeaker({actor: actor})});
    ChatMessage.create({content: anounceGM, speaker: ChatMessage.getSpeaker({actor: actor}),
      whisper: ChatMessage.getWhisperRecipients("GM")});

    const [newHP, newTempHP] = getNewHP(hp, max, temp, dapplied, {
      allowNegative: CONFIG.ALLOW_NEGATIVE,
    });

    if (CONFIG.ALLOW_DAMAGE_BUYOFF) {
      if (dapplied > hp) {
        // call ageConditions to handle any excess damage
        ageDamageBuyoff(actor, dapplied - hp);
      }
    } else if (dapplied >= hp) {
      ageNoDamageBuyoff(actor, dapplied - hp);
    }

    const updates = {
      _id: actor.id,
      isToken: actor.isToken,
      [`data.${CONFIG.HITPOINTS_ATTRIBUTE || 'attributes.hp.value'}`]: newHP,
      [`data.${
        CONFIG.TEMP_HITPOINTS_ATTRIBUTE || 'attributes.hp.temp'
      }`]: newTempHP,
    };
    console.log(updates);

    // Prepare the update
    return actor.update(updates);
  });

  return Promise.all(promises);
};

/**
 * Apply spillover damage (AGE system specific)
 *
 * @param {actor} ageSystemActor The actor being to apply conditions to
 * @param {number} dRemaining the damage remaing to be accounted for
 */
const ageDamageBuyoff = async(ageSystemActor, dRemaining) => {
  let conditions = ageSystemActor .data.data.conditions;
  let abilities = ageSystemActor .data.data.abilities;
  let speed = ageSystemActor .data.data.speed;
  let origin = ageSystemActor .data.data.ancestry;
  // let rolled = false;
  // let flavor = {};
  let flavor1 = CONFIG.INJURED;
  let flavor2 = CONFIG.WOUNDED;
  let flavor3 = CONFIG.DYING;
  let flavor4 = CONFIG.DEAD;
  let isExhausted   = conditions.exhausted;
  let isFatigued    = conditions.fatigued;
  let isInjured     = conditions.injured;
  let isWounded     = conditions.wounded;
  let isDying       = conditions.dying;
  let isProne       = conditions.prone;
  let isFreefalling = conditions.freefalling;
  let isHelpless    = conditions.helpless;
  let speedMod      = speed.mod;
  let speedTotal    = speed.total;

  // Get this speaker
  const this_speaker = ChatMessage.getSpeaker({actor: ageSystemActor});

  // Make sure this actor has their baseConValue recorded as a flag
  if (ageSystemActor.getFlag("world", "baseConValue") === undefined) {
      ageSystemActor.setFlag("world", "baseConValue", abilities.cons.value);
  } else if (abilities.cons.value > ageSystemActor.getFlag("world", "baseConValue")) {
      ageSystemActor.setFlag("world", "baseConValue", abilities.cons.value);
  }

  // If the character is a Belter switch token chat to Lang Belta
  if (origin === "Belter") {
    flavor1 = "Ouch! Deting hurt!";                // English: "Ouch! That hurt!"
    flavor2 = "Kaka felota! Deting REALLY hurt!";  // English: "Shit! That really hurt!"
    flavor3 = "Oyedeng. Tim fo wok wit da stars!"; // English: "Goodbye. Time to walk with the stars!"
    flavor4 = "Oye! na du beat wa det horse!";     // English: "Hey! Don't beat a dead horse!""
  }

  // If the dying condition is currently set
  if (isDying) {
    // More damage to a dead guy is senseless 
    ChatMessage.create({speaker: this_speaker, content: flavor4}); // Hey! Don't beat a dead horse!
  } else if (isWounded) {
    // If not freefalling, then character will also be prone
    if (!isFreefalling) isProne = true;

    // Set the dying condition
    // Dying characters are also unconscious, and helpless
    // Helpless characters can't move. Set the actor's speed.mod = -speed.total
    ageSystemActor.update({
      "data": {
        "conditions.dying": true,
        "conditions.unconscious": true,
        "conditions.helpless": true,
        "conditions.prone": isProne,
        "speed.mod": -speed.total,
        "speed.total": 0,
      }
    });
    ChatMessage.create({speaker: this_speaker, content: flavor3}); // Good by cruel world!
  } else if (isInjured) {
    // Character was already injured so may buy off 1d6 damage and take wounded condition
    let roll1 = new Roll("1d6").roll();

    // Announce the roll
    roll1.toMessage({speaker:{alias:this_speaker.alias}, flavor: flavor2});

    // Configure conditions: Add the exhausted condition,
    //    if already exhausted then helpless
    if (isExhausted) {
      isHelpless = true;
      speedMod = -speed.total;
      speedTotal = 0;
    } else {
      isExhausted = true;
      speedMod = -Math.ceil(speed.base/2);
      speedTotal = speed.total + speedMod;
    }

    // Set the conditions
    ageSystemActor.update({
      "data": {
        "conditions.wounded": true,
        "conditions.exhausted": true,
        "conditions.helpless": isHelpless,
        "speed.mod": speedMod,
        "speed.totla": speedTotal,
      }
    });

    if (roll1._total < dRemaining) {
      // Character is wounded but has more damage to account for, so now they're dying!
      // If not freefalling, then character will also be prone
      if (!isFreefalling) isProne = true;

      // Set the conditions
      // Dying characters are also unconscious, and helpless
      // Helpless characters can't move. Set the actor's speed.mod = -speed.total
      ageSystemActor.update({
        "data": {
          "conditions.dying": true,
          "conditions.unconscious": true,
          "conditions.helpless": true,
          "conditions.prone": isProne,
          "speed.mod": -speed.total,
          "speed.total": 0,
        }
      });
      ChatMessage.create({speaker: this_speaker, content: flavor3}); // Good by cruel world!
    }
  } else {
    // Character was uninjured prior to this damage, so may buy off 1d6 damage taking injured condition
    let roll1 = new Roll("1d6").roll();
    
    // Announce the roll
    roll1.toMessage({speaker: {alias:this_speaker.alias}, flavor: flavor1});

    // Configure conditions: Add the fatigued condition,
    //    if already fatigued then exhausted,
    //    if already exhausted then helpless
    if (isExhausted) {
      isHelpless = true;
      speedMod = -speed.total;
      speedTotal = 0;
    } else if (isFatigued) {
      isExhausted = true;
      speedMod = -Math.ceil(speed.base/2);
      speedTotal = speed.total + speedMod;
    } else isFatigued = true;

    // Set the conditions
    ageSystemActor.update({
      "data": {
        "conditions.injured": true,
        "conditions.fatigued": isFatigued,
        "conditions.exhausted": isExhausted,
        "conditions.helpless": isHelpless,
        "speed.mod": speedMod,
        "speed.total": speedTotal,
      }
    });

    if (roll1._total < dRemaining) {
      // Character is injured but has more damage to account for, so may buy off 1d6 damage taking wounded condition
      let roll2 = new Roll("1d6").roll();

      // Announce the roll
      roll2.toMessage({speaker: {alias:this_speaker.alias}, flavor: flavor2});

      // Configure conditions: Add the exhausted condition,
      //    if already exhausted then helpless
      if (isExhausted) {
        isHelpless = true;
        speedMod = -speed.total;
        speedTotal = 0;
      } else {
        isExhausted = true;
        speedMod = -Math.ceil(speed.base/2);
        speedTotal = speed.total + speedMod;
      }

      // Set the conditions
      ageSystemActor.update({
        "data": {
          "conditions.wounded": true,
          "conditions.exhausted": isExhausted,
          "conditions.helpless": isHelpless,
          "speed.mod": speedMod,
          "speed.total": speedTotal,
        }
      });

      if ((roll1._total + roll2._total) < dRemaining) {
        // Character is wounded but has more damage to account for, so now they're dying!
        // If not freefalling, then character will also be prone
        if (!isFreefalling) isProne = true;

        // Set the dying condition
        // Dying characters are also unconscious, and helpless
        // Helpless characters can't move. Set the actor's speed.mod = -speed.total
        ageSystemActor.update({
          "data": {
            "conditions.dying": true,
            "conditions.unconscious": true,
            "conditions.helpless": true,
            "conditions.prone": isProne,
            "speed.mod": -speed.total,
            "speed.total": 0,
          }
        });
        ChatMessage.create({speaker: this_speaker, content: flavor3}); // Good by cruel world!
      }
    }
  }
}

/**
 * Apply dying conditions (AGE system specific)
 *
 * @param {actor} ageSystemActor The actor being to apply conditions to
 *
 */
 const ageNoDamageBuyoff = async(ageSystemActor) => {
  let conditions = ageSystemActor .data.data.conditions;
  let abilities = ageSystemActor .data.data.abilities;
  let speed = ageSystemActor .data.data.speed;
  let origin = ageSystemActor .data.data.ancestry;
  // let flavor1 = CONFIG.INJURED;
  // let flavor2 = CONFIG.WOUNDED;
  let flavor3 = CONFIG.DYING;
  let flavor4 = CONFIG.DEAD;

  // Get this speaker
  const this_speaker = ChatMessage.getSpeaker({actor: ageSystemActor});
  // const this_speaker = ChatMessage.getSpeaker();

  // Make sure this actor has their baseConValue recorded as a flag
  if (ageSystemActor.getFlag("world", "baseConValue") === undefined) {
      ageSystemActor.setFlag("world", "baseConValue", abilities.cons.value);
  } else if (abilities.cons.value > ageSystemActor.getFlag("world", "baseConValue")) {
      ageSystemActor.setFlag("world", "baseConValue", abilities.cons.value);
  }
  if (origin === "Belter") {
    // flavor1 = "Ouch! Deting hurt!";                // English: "Ouch! That hurt!"
    // flavor2 = "Kaka felota! Deting REALLY hurt!";  // English: "Shit! That really hurt!"
    flavor3 = "Oyedeng. Tim fo wok wit da stars!"; // English: "Goodbye. Time to walk with the stars!"
    // flavor4 = "Oye! na du beat wa det horse!";     // English: "Hey! Don't beat a dead horse!""
  }

  // If the dying condition is currently set
  if (conditions.dying) {
    // More damage to a dead guy is senseless 
    ChatMessage.create({speaker: this_speaker, content: flavor4}); // Hey! Don't beat a dead horse!
  } else {
    let isProne = conditions.prone;
    // If not freefalling, then character will also be prone
    if (!conditions.freefalling) isProne = true;

    // Set the dying condition
    // Dying characters are also unconscious, and helpless
    // Helpless characters can't move. Set the actor's speed.mod = -speed.total
    ageSystemActor.update({
      "data": {
        "conditions.dying": true,
        "conditions.unconscious": true,
        "conditions.helpless": true,
        "conditions.prone": isProne,
        "speed.mod": -speed.total,
        "speed.total": 0,
      }
    });
    ChatMessage.create({speaker: this_speaker, content: flavor3}); // Good by cruel world!
  }
}

/**
 * Display token Health overlay.
 *
 * @returns {Promise<void>}
 */
const displayOverlay = async (isDamage, isTargeted = false) => {
  levelUpDisplayed = true;

  const buttons = {
    heal: {
      icon: "<i class='fas fa-plus-circle'></i>",
      label: `${i18n('TOKEN_HEALTH.Heal')}  <kbd>⮐</kbd>`,
      callback: html => applyDamage(html, isDamage, isTargeted),
      condition: !isDamage,
    },
    damage: {
      icon: "<i class='fas fa-minus-circle'></i>",
      label: `${i18n('TOKEN_HEALTH.Damage')}  <kbd>⮐</kbd>`,
      callback: html => applyDamage(html, isDamage, isTargeted),
      condition: isDamage,
    },
  };

  let dialogTitle = `TOKEN_HEALTH.Dialog_${isDamage ? 'Damage' : 'Heal'}_Title${
    isTargeted ? '_targeted' : ''
  }`;

  const tokens = isTargeted ? Array.from(game.user.targets) : canvas.tokens.controlled
  const nameOfTokens = tokens.map(t => t.name).sort((a, b) => a.length - b.length).join(', ')
  // we will show the first four thumbnails, with the 4th cut in half and gradually more and more translucent
  let thumbnails = tokens.slice(0, 4).map((t, idx) => ({ image: t.data.img, opacity: (1 - 0.15 * idx) }))

  const content = await renderTemplate(
    `modules/level-up/templates/level-up.hbs`,
    { thumbnails },
  );

  // Render the dialog
  dialog = new levelUpDialog({
    title: i18n(dialogTitle).replace('$1', nameOfTokens),
    buttons,
    content,
    default: isDamage ? 'damage' : 'heal',
    close: () => {
      timer = setTimeout(() => {
        levelUpDisplayed = false;
      }, DELAY);
    },
  }).render(true);
};

/**
 * Force closing dialog on Escape (FVTT denies that if you focus something)
 */
const onEscape = () => {
  if (dialog && levelUpDisplayed) {
    dialog.close();
  }
};

/**
 * Open the dialog on ToggleKey
 */
const toggle = (event, key, isDamage = true, isTarget = false) => {
  event.preventDefault();

  // Make sure to call only once.
  keyboard._handled.add(key);

  // Don't display if no tokens are controlled. Don't display as well if we were trying
  // to apply damage to targets
  if (
    !levelUpDisplayed &&
    canvas.tokens.controlled.length > 0 &&
    !isTarget
  ) {
    displayOverlay(isDamage).catch(console.error);
  }
  // Don't display if no tokens are targeted and we were trying to attack selected
  if (!levelUpDisplayed && game.user.targets.size > 0 && isTarget) {
    displayOverlay(isDamage, isTarget).catch(console.error);
  }
};

/**
 * Handle custom keys not handled by FVTT
 *
 * @param {KeyboardEvent} event The keyboard event
 * @param {string} key The pressed key
 * @param {Boolean} up Is the button up
 */
const handleKeys = function (event, key, up) {
  if (up || this.hasFocus) return;

  // Base key is pressed.
  const toggleKeyBase = KeyBinding.parse(CONFIG.TOGGLE_KEY_BASE);
  if (KeyBinding.eventIsForBinding(event, toggleKeyBase)) toggle(event, key);

  // Alt key is pressed.
  const toggleKeyAlt = KeyBinding.parse(CONFIG.TOGGLE_KEY_ALT);
  if (KeyBinding.eventIsForBinding(event, toggleKeyAlt))
    toggle(event, key, false);

  // Targeting key is pressed
  const toggleKeyTarget = KeyBinding.parse(CONFIG.TOGGLE_KEY_TARGET);
  if (KeyBinding.eventIsForBinding(event, toggleKeyTarget))
    toggle(event, key, true, true);

  // Alt Targeting key is pressed
  const toggleKeyTargetAlt = KeyBinding.parse(CONFIG.TOGGLE_KEY_TARGET_ALT);
  if (KeyBinding.eventIsForBinding(event, toggleKeyTargetAlt))
    toggle(event, key, false, true);
};

/**
 * Initialize our stuff
 */
Hooks.once('ready', () => {
  // Extend _handleKeys method with our own function
  const cached_handleKeys = keyboard._handleKeys;
  keyboard._handleKeys = function () {
    handleKeys.call(this, ...arguments);
    cached_handleKeys.call(this, ...arguments);
  };

  // Extend _onEscape method with our own function
  const cached_onEscape = keyboard._onEscape;
  keyboard._onEscape = function () {
    onEscape.call(this, ...arguments);
    cached_onEscape.call(this, ...arguments);
  };

  // Initialize settings
  settings();

  // Use Azzurite settings-extender
  KeyBinding = window.Azzu.SettingsTypes.KeyBinding;
});
