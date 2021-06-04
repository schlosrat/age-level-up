import {i18n} from './ui.js';

const MODULE_NAME = 'token-health';

export const CONFIG = {};
const DEFAULT = {
  TOGGLE_KEY_BASE: 'Enter',
  TOGGLE_KEY_ALT: 'Shift + Enter',
  TOGGLE_KEY_TARGET: 'Alt + Enter',
  TOGGLE_KEY_TARGET_ALT: 'Alt + Shift + Enter',
  HITPOINTS_ATTRIBUTE: '',
  MAX_HITPOINTS_ATTRIBUTE: '',
  TEMP_HITPOINTS_ATTRIBUTE: '',
  MITIGATION_ATTRIBUTE_1: '',
  MITIGATION_ATTRIBUTE_2: '',
  ALLOW_NEGATIVE: false,
  ALLOW_TEMP: false,
  ALLOW_DAMAGE_BUYOFF: false,
};

/**
 * Set all default settings, based on game system
 */
const setDefaults = () => {
  // Default to system values
  if (game.system.id === 'dnd5e' || game.system.id === 'pf2e') {
    DEFAULT.HITPOINTS_ATTRIBUTE = 'attributes.hp.value';
    DEFAULT.MAX_HITPOINTS_ATTRIBUTE = 'attributes.hp.max';
    DEFAULT.TEMP_HITPOINTS_ATTRIBUTE = 'attributes.hp.temp';
  } else if (game.system.id === 'age-system') {
    DEFAULT.HITPOINTS_ATTRIBUTE = 'health.value';
    DEFAULT.MAX_HITPOINTS_ATTRIBUTE = 'health.max';
    DEFAULT.MITIGATION_ATTRIBUTE_1 = 'armor.toughness.total';
    DEFAULT.MITIGATION_ATTRIBUTE_2 = '';
    DEFAULT.ALLOW_DAMAGE_BUYOFF = true;
  } else {
    DEFAULT.HITPOINTS_ATTRIBUTE = 'health.value';
    DEFAULT.MAX_HITPOINTS_ATTRIBUTE = 'health.max';
  }
};

/**
 * Sets the settings or returns the current value.
 *
 * @param key
 * @param setting
 * @returns {*}
 */
const initSetting = (key, setting) => {
  let config;

  try {
    config = game.settings.get(MODULE_NAME, key);
  } catch (e) {
    if (e.message === 'This is not a registered game setting') {
      game.settings.register(MODULE_NAME, key, setting);
      config = game.settings.get(MODULE_NAME, key);
    } else {
      throw e;
    }
  }

  return config;
};

const KeyBinding = window.Azzu.SettingsTypes.KeyBinding;

/**
 * Register settings
 */
export default () => {
  setDefaults();

  CONFIG.TOGGLE_KEY_BASE = initSetting('toggleKey', {
    name: i18n('TOKEN_HEALTH.toggleKeyName'),
    hint: i18n('TOKEN_HEALTH.toggleKeyHint'),
    type: KeyBinding,
    default: DEFAULT.TOGGLE_KEY_BASE,
    scope: 'user',
    config: true,
    onChange: key => {
      CONFIG.TOGGLE_KEY_BASE = key;
    },
  });
  CONFIG.TOGGLE_KEY_ALT = initSetting('toggleKeyAlt', {
    name: i18n('TOKEN_HEALTH.toggleKeyAltName'),
    hint: i18n('TOKEN_HEALTH.toggleKeyAltHint'),
    type: KeyBinding,
    default: DEFAULT.TOGGLE_KEY_ALT,
    scope: 'user',
    config: true,
    onChange: key => {
      CONFIG.TOGGLE_KEY_ALT = key;
    },
  });
  CONFIG.TOGGLE_KEY_TARGET = initSetting('toggleKeyTarget', {
    name: i18n('TOKEN_HEALTH.toggleKeyTargetName'),
    hint: i18n('TOKEN_HEALTH.toggleKeyTargetHint'),
    type: KeyBinding,
    default: DEFAULT.TOGGLE_KEY_TARGET,
    scope: 'user',
    config: true,
    onChange: key => {
      CONFIG.TOGGLE_KEY_TARGET = key;
    },
  });
  CONFIG.TOGGLE_KEY_TARGET_ALT = initSetting('toggleKeyTargetAlt', {
    name: i18n('TOKEN_HEALTH.toggleKeyTargetAltName'),
    hint: i18n('TOKEN_HEALTH.toggleKeyTargetAltHint'),
    type: KeyBinding,
    default: DEFAULT.TOGGLE_KEY_TARGET_ALT,
    scope: 'user',
    config: true,
    onChange: key => {
      CONFIG.TOGGLE_KEY_TARGET_ALT = key;
    },
  });
  CONFIG.HITPOINTS_ATTRIBUTE = initSetting('hpSource', {
    name: i18n('TOKEN_HEALTH.hp'),
    type: String,
    default: DEFAULT.HITPOINTS_ATTRIBUTE,
    scope: 'world',
    config: true,
    onChange: key => {
      CONFIG.HITPOINTS_ATTRIBUTE = key;
    },
  });
  CONFIG.MAX_HITPOINTS_ATTRIBUTE = initSetting('hpSourceMax', {
    name: i18n('TOKEN_HEALTH.hpMax'),
    type: String,
    default: DEFAULT.MAX_HITPOINTS_ATTRIBUTE,
    scope: 'world',
    config: true,
    onChange: key => {
      CONFIG.MAX_HITPOINTS_ATTRIBUTE = key;
    },
  });
  CONFIG.TEMP_HITPOINTS_ATTRIBUTE = initSetting('tempHpSource', {
    name: i18n('TOKEN_HEALTH.tempHp'),
    hint: i18n('TOKEN_HEALTH.tempHpHint'),
    type: String,
    default: DEFAULT.TEMP_HITPOINTS_ATTRIBUTE,
    scope: 'world',
    config: true,
    onChange: key => {
      CONFIG.TEMP_HITPOINTS_ATTRIBUTE = key;
    },
  });
  CONFIG.MITIGATION_ATTRIBUTE_1 = initSetting('mitigationSource1', {
    name: i18n('TOKEN_HEALTH.mitigation1'),
    hint: i18n('TOKEN_HEALTH.mitigation1Hint'),
    type: String,
    default: DEFAULT.MITIGATION_ATTRIBUTE_1,
    scope: 'world',
    config: true,
    onChange: key => {
      CONFIG.MITIGATION_ATTRIBUTE_1 = key;
    },
  });
  CONFIG.MITIGATION_ATTRIBUTE_2 = initSetting('mitigationSource2', {
    name: i18n('TOKEN_HEALTH.mitigation2'),
    hint: i18n('TOKEN_HEALTH.mitigation2Hint'),
    type: String,
    default: DEFAULT.MITIGATION_ATTRIBUTE_2,
    scope: 'world',
    config: true,
    onChange: key => {
      CONFIG.MITIGATION_ATTRIBUTE_2 = key;
    },
  });
  CONFIG.ALLOW_NEGATIVE = initSetting('allowNegative', {
    name: i18n('TOKEN_HEALTH.allowNegative'),
    hint: i18n('TOKEN_HEALTH.allowNegativeHint'),
    type: Boolean,
    default: DEFAULT.ALLOW_NEGATIVE,
    scope: 'world',
    config: true,
    onChange: key => {
      CONFIG.ALLOW_NEGATIVE = key;
    },
  });
  CONFIG.ALLOW_DAMAGE_BUYOFF = initSetting('allowDamageBuyoff', {
    name: i18n('TOKEN_HEALTH.allowDamageBuyoff'),
    hint: i18n('TOKEN_HEALTH.allowDamageBuyoffHint'),
    type: Boolean,
    default: DEFAULT.ALLOW_DAMAGE_BUYOFF,
    scope: 'world',
    config: true,
    onChange: key => {
      CONFIG.ALLOW_DAMAGE_BUYOFF = key;
    },
  });
  CONFIG.OUCH = i18n("TOKEN_HEALTH.ouch");                    // token chat if takeing damage (preable)
  CONFIG.DAMAGE_POINT = i18n("TOKEN_HEALTH.damagePoint");     // token chat if takeing 1 point of damage (ending)
  CONFIG.DAMAGE_POINTS = i18n("TOKEN_HEALTH.damagePoints");   // token chat if takeing >1 points of damage (ending)
  CONFIG.TY = i18n("TOKEN_HEALTH.ty");                        // token chat if taking healing (preable)
  CONFIG.HEALING_POINT = i18n("TOKEN_HEALTH.healingPoint");   // token chat if takeing 1 point of healing (ending)
  CONFIG.HEALING_POINTS = i18n("TOKEN_HEALTH.healingPoints"); // token chat if takeing > 1 points of healing (ending)
  CONFIG.MEH = i18n("TOKEN_HEALTH.meh");                      // token chat if no damage or healing taken (all was mitigated/none needed)
  CONFIG.INJURED = i18n("TOKEN_HEALTH.injured");              // token chat if taking the injured condition
  CONFIG.WOUNDED = i18n("TOKEN_HEALTH.wounded");              // token chat if taking the wonded condition
  CONFIG.DYING = i18n("TOKEN_HEALTH.dying");                  // token chat if damage results in death
  CONFIG.DEAD = i18n("TOKEN_HEALTH.dead");                    // token chat if you apply damage to the dead
};
