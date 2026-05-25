/**
 * Emoji Data Package (pb 数据包)
 *
 * Structure:
 * - categories[]: top-level categories with subcategories and emojis
 * - Each emoji: { key: i18n_key, char: UTF8_emoji, name: Chinese_desc }
 * - flatIndex: flat array for search, each entry has { key, char, name, categoryName, subcategoryName }
 *
 * This serves as both the emoji data package and the langpn (language pack).
 * i18n keys use dot notation: emoji.{category}.{subcategory}.{name}
 */

(function initEmojiDataModule(global) {
  "use strict";

  /**
   * Full emoji dataset organized by categories and subcategories.
   * langpn: all user-visible names are in Simplified Chinese.
   */
  var EMOJI_CATEGORIES = [
    {
      key: "smileys_and_emotion",
      name: "笑脸和情感",
      char: "😂",
      subcategories: [
        {
          key: "smiling_faces",
          name: "笑脸",
          char: "😄",
          emojis: [
            { key: "grinning_face", char: "😀", name: "嘿嘿" },
            { key: "grinning_face_with_big_eyes", char: "😃", name: "哈哈" },
            { key: "grinning_squinting_face", char: "😄", name: "大笑" },
            { key: "beaming_face", char: "😁", name: "嘻嘻" },
            { key: "grinning_squinting_face2", char: "😆", name: "斜眼笑" },
            { key: "grinning_face_with_sweat", char: "😅", name: "苦笑" },
            { key: "rolling_on_the_floor_laughing", char: "🤣", name: "笑得满地打滚" },
            { key: "face_with_tears_of_joy", char: "😂", name: "笑哭了" },
            { key: "slightly_smiling_face", char: "🙂", name: "呵呵" },
            { key: "upside_down_face", char: "🙃", name: "倒脸" },
            { key: "melting_face", char: "🫠", name: "融化" },
            { key: "winking_face", char: "😉", name: "眨眼" },
            { key: "blushing_smiling_face", char: "😊", name: "羞涩微笑" },
            { key: "angel_smiling_face", char: "😇", name: "微笑天使" }
          ]
        },
        {
          key: "affection_faces",
          name: "示爱的脸",
          char: "😍",
          emojis: [
            { key: "smiling_face_with_hearts", char: "🥰", name: "喜笑颜开" },
            { key: "heart_eyes_face", char: "😍", name: "花痴" },
            { key: "star_struck_face", char: "🤩", name: "好崇拜哦" },
            { key: "kissing_face_blowing", char: "😘", name: "飞吻" },
            { key: "kissing_face", char: "😗", name: "亲亲" },
            { key: "smiling_face_white", char: "☺", name: "微笑" },
            { key: "kissing_face_closed_eyes", char: "😚", name: "羞涩亲亲" },
            { key: "kissing_face_smiling_eyes", char: "😙", name: "微笑亲亲" },
            { key: "smiling_face_with_tear", char: "🥲", name: "含泪的笑脸" }
          ]
        },
        {
          key: "tongue_faces",
          name: "吐舌头的脸",
          char: "😛",
          emojis: [
            { key: "yummy_face", char: "😋", name: "好吃" },
            { key: "face_with_tongue", char: "😛", name: "吐舌" },
            { key: "winking_face_with_tongue", char: "😜", name: "单眼吐舌" },
            { key: "zany_face", char: "🤪", name: "滑稽" },
            { key: "squinting_face_with_tongue", char: "😝", name: "眯眼吐舌" },
            { key: "money_mouth_face", char: "🤑", name: "发财" }
          ]
        },
        {
          key: "hand_gesture_faces",
          name: "带手势的脸",
          char: "🤔",
          emojis: [
            { key: "hugging_face", char: "🤗", name: "抱抱" },
            { key: "face_with_hand_over_mouth", char: "🤭", name: "不说" },
            { key: "face_with_open_eyes_and_hand_over_mouth", char: "🫢", name: "睁眼捂嘴" },
            { key: "face_with_peeking_eye", char: "🫣", name: "偷看" },
            { key: "shushing_face", char: "🤫", name: "安静的脸" },
            { key: "thinking_face", char: "🤔", name: "想一想" },
            { key: "saluting_face", char: "🫡", name: "致敬" }
          ]
        },
        {
          key: "neutral_and_skeptical",
          name: "无感情和怀疑的脸",
          char: "🤐",
          emojis: [
            { key: "zipper_mouth_face", char: "🤐", name: "闭嘴" },
            { key: "face_with_raised_eyebrow", char: "🤨", name: "挑眉" },
            { key: "neutral_face", char: "😐", name: "冷漠" },
            { key: "expressionless_face", char: "😑", name: "无语" },
            { key: "face_without_mouth", char: "😶", name: "沉默" },
            { key: "dotted_line_face", char: "🫥", name: "虚线脸" },
            { key: "face_in_clouds", char: "😶‍🌫️", name: "迷茫" },
            { key: "smirking_face", char: "😏", name: "得意" },
            { key: "unamused_face", char: "😒", name: "不高兴" },
            { key: "face_with_rolling_eyes", char: "🙄", name: "翻白眼" },
            { key: "grimacing_face", char: "😬", name: "龇牙咧嘴" },
            { key: "face_exhaling", char: "😮‍💨", name: "呼气" },
            { key: "lying_face", char: "🤥", name: "说谎" }
          ]
        },
        {
          key: "sleepy_faces",
          name: "困倦的脸",
          char: "😴",
          emojis: [
            { key: "relieved_face", char: "😌", name: "松了口气" },
            { key: "pensive_face", char: "😔", name: "沉思" },
            { key: "sleepy_face", char: "😪", name: "困" },
            { key: "drooling_face", char: "🤤", name: "流口水" },
            { key: "sleeping_face", char: "😴", name: "睡着了" }
          ]
        },
        {
          key: "sick_faces",
          name: "生病的脸",
          char: "🤧",
          emojis: [
            { key: "face_with_medical_mask", char: "😷", name: "感冒" },
            { key: "face_with_thermometer", char: "🤒", name: "发烧" },
            { key: "face_with_head_bandage", char: "🤕", name: "受伤" },
            { key: "nauseated_face", char: "🤢", name: "恶心" },
            { key: "face_vomiting", char: "🤮", name: "呕吐" },
            { key: "sneezing_face", char: "🤧", name: "打喷嚏" },
            { key: "hot_face", char: "🥵", name: "脸发烧" },
            { key: "cold_face", char: "🥶", name: "冷脸" },
            { key: "woozy_face", char: "🥴", name: "头昏眼花" },
            { key: "dizzy_face", char: "😵", name: "晕头转向" },
            { key: "face_with_spiral_eyes", char: "😵‍💫", name: "晕" },
            { key: "exploding_head", char: "🤯", name: "爆炸头" }
          ]
        },
        {
          key: "hat_faces",
          name: "戴帽子的脸",
          char: "🤠",
          emojis: [
            { key: "cowboy_hat_face", char: "🤠", name: "牛仔帽脸" },
            { key: "partying_face", char: "🥳", name: "聚会笑脸" },
            { key: "disguised_face", char: "🥸", name: "伪装的脸" }
          ]
        },
        {
          key: "glasses_faces",
          name: "戴眼镜的脸",
          char: "😎",
          emojis: [
            { key: "smiling_face_with_sunglasses", char: "😎", name: "墨镜笑脸" },
            { key: "nerd_face", char: "🤓", name: "书呆子脸" },
            { key: "face_with_monocle", char: "🧐", name: "带单片眼镜的脸" }
          ]
        },
        {
          key: "concerned_faces",
          name: "担心的脸",
          char: "😞",
          emojis: [
            { key: "confused_face2", char: "😕", name: "困扰" },
            { key: "face_with_diagonal_mouth", char: "🫤", name: "郁闷" },
            { key: "worried_face", char: "😟", name: "担心" },
            { key: "slightly_frowning_face", char: "🙁", name: "微微不满" },
            { key: "frowning_face", char: "☹", name: "不满" },
            { key: "face_with_open_mouth", char: "😮", name: "吃惊" },
            { key: "hushed_face", char: "😯", name: "缄默" },
            { key: "astonished_face", char: "😲", name: "震惊" },
            { key: "flushed_face", char: "😳", name: "脸红" },
            { key: "pleading_face", char: "🥺", name: "恳求的脸" },
            { key: "face_holding_back_tears", char: "🥹", name: "忍住泪水" },
            { key: "frowning_face_with_open_mouth", char: "😦", name: "啊" },
            { key: "anguished_face", char: "😧", name: "极度痛苦" },
            { key: "fearful_face", char: "😨", name: "害怕" },
            { key: "anxious_face_with_sweat", char: "😰", name: "冷汗" },
            { key: "sad_but_relieved_face", char: "😥", name: "失望但如释重负" },
            { key: "crying_face", char: "😢", name: "哭" },
            { key: "loudly_crying_face", char: "😭", name: "放声大哭" },
            { key: "face_screaming_in_fear", char: "😱", name: "吓死了" },
            { key: "confounded_face", char: "😖", name: "困惑" },
            { key: "persevering_face", char: "😣", name: "痛苦" },
            { key: "disappointed_face", char: "😞", name: "失望" },
            { key: "face_with_cold_sweat", char: "😓", name: "汗" },
            { key: "weary_face", char: "😩", name: "累死了" },
            { key: "tired_face", char: "😫", name: "累" },
            { key: "yawning_face", char: "🥱", name: "打呵欠" }
          ]
        },
        {
          key: "negative_faces",
          name: "负面情绪的脸",
          char: "😠",
          emojis: [
            { key: "face_with_steam_from_nose", char: "😤", name: "傲慢" },
            { key: "pouting_face", char: "😡", name: "怒火中烧" },
            { key: "angry_face", char: "😠", name: "生气" },
            { key: "face_with_symbols_on_mouth", char: "🤬", name: "嘴上有符号的脸" },
            { key: "smiling_devil_face", char: "😈", name: "恶魔微笑" },
            { key: "angry_devil_face", char: "👿", name: "生气的恶魔" },
            { key: "skull", char: "💀", name: "头骨" },
            { key: "skull_and_crossbones", char: "☠", name: "骷髅" }
          ]
        },
        {
          key: "costume_faces",
          name: "装扮的脸",
          char: "💩",
          emojis: [
            { key: "pile_of_poo", char: "💩", name: "大便" },
            { key: "clown_face", char: "🤡", name: "小丑脸" },
            { key: "ogre", char: "👹", name: "食人魔" },
            { key: "goblin", char: "👺", name: "小妖精" },
            { key: "ghost", char: "👻", name: "鬼" },
            { key: "alien", char: "👽", name: "外星人" },
            { key: "alien_monster", char: "👾", name: "外星怪物" },
            { key: "robot", char: "🤖", name: "机器人" }
          ]
        },
        {
          key: "cat_faces",
          name: "猫咪脸",
          char: "😸",
          emojis: [
            { key: "grinning_cat", char: "😺", name: "大笑的猫" },
            { key: "smiling_cat", char: "😸", name: "微笑的猫" },
            { key: "cat_with_tears_of_joy", char: "😹", name: "笑出眼泪的猫" },
            { key: "heart_eyes_cat", char: "😻", name: "花痴的猫" },
            { key: "smirking_cat", char: "😼", name: "奸笑的猫" },
            { key: "kissing_cat", char: "😽", name: "亲亲猫" },
            { key: "weary_cat", char: "🙀", name: "疲倦的猫" },
            { key: "crying_cat", char: "😿", name: "哭泣的猫" },
            { key: "pouting_cat", char: "😾", name: "生气的猫" }
          ]
        },
        {
          key: "monkey_faces",
          name: "猴子脸",
          char: "🙈",
          emojis: [
            { key: "see_no_evil_monkey", char: "🙈", name: "非礼勿视" },
            { key: "hear_no_evil_monkey", char: "🙉", name: "非礼勿听" },
            { key: "speak_no_evil_monkey", char: "🙊", name: "非礼勿言" }
          ]
        },
        {
          key: "hearts",
          name: "爱心",
          char: "❤️",
          emojis: [
            { key: "love_letter", char: "💌", name: "情书" },
            { key: "heart_with_arrow", char: "💘", name: "心中箭了" },
            { key: "heart_with_ribbon", char: "💝", name: "系有缎带的心" },
            { key: "sparkling_heart", char: "💖", name: "闪亮的心" },
            { key: "growing_heart", char: "💗", name: "搏动的心" },
            { key: "beating_heart", char: "💓", name: "心跳" },
            { key: "revolving_hearts", char: "💞", name: "舞动的心" },
            { key: "two_hearts", char: "💕", name: "两颗心" },
            { key: "heart_decoration", char: "💟", name: "心型装饰" },
            { key: "heart_exclamation", char: "❣", name: "心叹号" },
            { key: "broken_heart", char: "💔", name: "心碎" },
            { key: "heart_on_fire", char: "❤️‍🔥", name: "火上之心" },
            { key: "mending_heart", char: "❤️‍🩹", name: "修复受伤的心灵" },
            { key: "red_heart", char: "❤", name: "红心" },
            { key: "orange_heart", char: "🧡", name: "橙心" },
            { key: "yellow_heart", char: "💛", name: "黄心" },
            { key: "green_heart", char: "💚", name: "绿心" },
            { key: "blue_heart", char: "💙", name: "蓝心" },
            { key: "purple_heart", char: "💜", name: "紫心" },
            { key: "brown_heart", char: "🤎", name: "棕心" },
            { key: "black_heart", char: "🖤", name: "黑心" },
            { key: "white_heart", char: "🤍", name: "白心" }
          ]
        },
        {
          key: "emotion_symbols",
          name: "情感",
          char: "💋",
          emojis: [
            { key: "kiss_mark", char: "💋", name: "唇印" },
            { key: "hundred_points", char: "💯", name: "一百分" },
            { key: "anger_symbol", char: "💢", name: "怒" },
            { key: "collision", char: "💥", name: "爆炸" },
            { key: "dizzy", char: "💫", name: "头晕" },
            { key: "sweat_droplets", char: "💦", name: "汗滴" },
            { key: "dashing_away", char: "💨", name: "尾气" },
            { key: "hole", char: "🕳", name: "洞" },
            { key: "speech_balloon", char: "💬", name: "话语气泡" },
            { key: "eye_in_speech_bubble", char: "👁️‍🗨️", name: "眼睛对话框" },
            { key: "left_speech_bubble", char: "🗨", name: "朝左的话语气泡" },
            { key: "anger_bubble", char: "🗯", name: "愤怒话语气泡" },
            { key: "thought_balloon", char: "💭", name: "内心活动气泡" },
            { key: "zzz", char: "💤", name: "睡着" }
          ]
        }
      ]
    },
    {
      key: "people_and_body",
      name: "人物和身体",
      char: "✌️",
      subcategories: [
        {
          key: "open_hand",
          name: "手掌张开",
          char: "🖐️",
          emojis: [
            { key: "waving_hand", char: "👋", name: "挥手" },
            { key: "raised_back_of_hand", char: "🤚", name: "立起的手背" },
            { key: "hand_with_fingers_splayed", char: "🖐", name: "手掌" },
            { key: "raised_hand", char: "✋", name: "举起手" },
            { key: "vulcan_salute", char: "🖖", name: "瓦肯举手礼" },
            { key: "rightwards_hand", char: "🫱", name: "向右的手" },
            { key: "leftwards_hand", char: "🫲", name: "向左的手" },
            { key: "palm_down_hand", char: "🫳", name: "掌心向下的手" },
            { key: "palm_up_hand", char: "🫴", name: "掌心向上的手" }
          ]
        },
        {
          key: "finger_gestures",
          name: "手指手势",
          char: "👌",
          emojis: [
            { key: "ok_hand", char: "👌", name: "OK" },
            { key: "pinched_fingers", char: "🤌", name: "捏手指" },
            { key: "pinching_hand", char: "🤏", name: "捏合的手势" },
            { key: "victory_hand", char: "✌", name: "胜利手势" },
            { key: "crossed_fingers", char: "🤞", name: "交叉的手指" },
            { key: "hand_with_index_finger_and_thumb_crossed", char: "🫰", name: "食指与拇指交叉的手" },
            { key: "love_you_gesture", char: "🤟", name: "爱你的手势" },
            { key: "sign_of_the_horns", char: "🤘", name: "摇滚" },
            { key: "call_me_hand", char: "🤙", name: "给我打电话" }
          ]
        },
        {
          key: "pointing_gestures",
          name: "指向手势",
          char: "👈",
          emojis: [
            { key: "backhand_index_pointing_left", char: "👈", name: "反手食指向左指" },
            { key: "backhand_index_pointing_right", char: "👉", name: "反手食指向右指" },
            { key: "backhand_index_pointing_up", char: "👆", name: "反手食指向上指" },
            { key: "middle_finger", char: "🖕", name: "竖中指" },
            { key: "backhand_index_pointing_down", char: "👇", name: "反手食指向下指" },
            { key: "index_pointing_up", char: "☝", name: "食指向上指" },
            { key: "index_pointing_at_viewer", char: "🫵", name: "指向观察者的食指" }
          ]
        },
        {
          key: "fist_gestures",
          name: "手掌握紧",
          char: "👍",
          emojis: [
            { key: "thumbs_up", char: "👍", name: "拇指向上" },
            { key: "thumbs_down", char: "👎", name: "拇指向下" },
            { key: "raised_fist", char: "✊", name: "举起拳头" },
            { key: "oncoming_fist", char: "👊", name: "出拳" },
            { key: "left_facing_fist", char: "🤛", name: "朝左的拳头" },
            { key: "right_facing_fist", char: "🤜", name: "朝右的拳头" }
          ]
        },
        {
          key: "two_hand_gestures",
          name: "双手手势",
          char: "🤝",
          emojis: [
            { key: "clapping_hands", char: "👏", name: "鼓掌" },
            { key: "raising_hands", char: "🙌", name: "举双手" },
            { key: "heart_hands", char: "🫶", name: "做成心形的双手" },
            { key: "open_hands", char: "👐", name: "张开双手" },
            { key: "palms_up_together", char: "🤲", name: "掌心向上托起" },
            { key: "handshake", char: "🤝", name: "握手" },
            { key: "folded_hands", char: "🙏", name: "双手合十" }
          ]
        },
        {
          key: "holding_gestures",
          name: "持物手势",
          char: "✍️",
          emojis: [
            { key: "writing_hand", char: "✍", name: "写字" },
            { key: "nail_polish", char: "💅", name: "涂指甲油" },
            { key: "selfie", char: "🤳", name: "自拍" }
          ]
        },
        {
          key: "body_parts",
          name: "身体部位",
          char: "👃",
          emojis: [
            { key: "flexed_biceps", char: "💪", name: "肌肉" },
            { key: "mechanical_arm", char: "🦾", name: "机械手臂" },
            { key: "mechanical_leg", char: "🦿", name: "机械腿" },
            { key: "leg", char: "🦵", name: "腿" },
            { key: "foot", char: "🦶", name: "脚" },
            { key: "ear", char: "👂", name: "耳朵" },
            { key: "ear_with_hearing_aid", char: "🦻", name: "戴助听器的耳朵" },
            { key: "nose", char: "👃", name: "鼻子" },
            { key: "brain", char: "🧠", name: "脑" },
            { key: "anatomical_heart", char: "🫀", name: "心脏器官" },
            { key: "lungs", char: "🫁", name: "肺" },
            { key: "tooth", char: "🦷", name: "牙齿" },
            { key: "bone", char: "🦴", name: "骨头" },
            { key: "eyes", char: "👀", name: "双眼" },
            { key: "eye", char: "👁", name: "眼睛" },
            { key: "tongue", char: "👅", name: "舌头" },
            { key: "mouth", char: "👄", name: "嘴" },
            { key: "biting_lip", char: "🫦", name: "咬住嘴唇" }
          ]
        },
        {
          key: "people",
          name: "人物",
          char: "👦",
          emojis: [
            { key: "baby", char: "👶", name: "小宝贝" },
            { key: "child", char: "🧒", name: "儿童" },
            { key: "boy", char: "👦", name: "男孩" },
            { key: "girl", char: "👧", name: "女孩" },
            { key: "adult", char: "🧑", name: "成人" },
            { key: "person_blond_hair", char: "👱", name: "金色头发的人" },
            { key: "man", char: "👨", name: "男人" },
            { key: "person_beard", char: "🧔", name: "有胡子的人" },
            { key: "man_beard", char: "🧔‍♂️", name: "有络腮胡子的男人" },
            { key: "woman_beard", char: "🧔‍♀️", name: "有络腮胡子的女人" },
            { key: "man_red_hair", char: "👨‍🦰", name: "男人: 红发" },
            { key: "man_curly_hair", char: "👨‍🦱", name: "男人: 卷发" },
            { key: "man_white_hair", char: "👨‍🦳", name: "男人: 白发" },
            { key: "man_bald", char: "👨‍🦲", name: "男人: 秃顶" },
            { key: "woman", char: "👩", name: "女人" },
            { key: "woman_red_hair", char: "👩‍🦰", name: "女人: 红发" },
            { key: "adult_red_hair", char: "🧑‍🦰", name: "成人: 红发" },
            { key: "woman_curly_hair", char: "👩‍🦱", name: "女人: 卷发" },
            { key: "adult_curly_hair", char: "🧑‍🦱", name: "成人: 卷发" },
            { key: "woman_white_hair", char: "👩‍🦳", name: "女人: 白发" },
            { key: "adult_white_hair", char: "🧑‍🦳", name: "成人: 白发" },
            { key: "woman_bald", char: "👩‍🦲", name: "女人: 秃顶" },
            { key: "adult_bald", char: "🧑‍🦲", name: "成人: 秃顶" },
            { key: "woman_blond_hair", char: "👱‍♀️", name: "金发女" },
            { key: "man_blond_hair", char: "👱‍♂️", name: "金发男" },
            { key: "older_person", char: "🧓", name: "老年人" },
            { key: "old_man", char: "👴", name: "老爷爷" },
            { key: "old_woman", char: "👵", name: "老奶奶" }
          ]
        },
        {
          key: "person_gesture",
          name: "人物姿势",
          char: "🙋",
          emojis: [
            { key: "person_frowning", char: "🙍", name: "皱眉" },
            { key: "man_frowning", char: "🙍‍♂️", name: "皱眉男" },
            { key: "woman_frowning", char: "🙍‍♀️", name: "皱眉女" },
            { key: "person_pouting", char: "🙎", name: "撅嘴" },
            { key: "man_pouting", char: "🙎‍♂️", name: "撅嘴男" },
            { key: "woman_pouting", char: "🙎‍♀️", name: "撅嘴女" },
            { key: "person_gesturing_no", char: "🙅", name: "禁止手势" },
            { key: "man_gesturing_no", char: "🙅‍♂️", name: "禁止手势男" },
            { key: "woman_gesturing_no", char: "🙅‍♀️", name: "禁止手势女" },
            { key: "person_gesturing_ok", char: "🙆", name: "OK手势" },
            { key: "man_gesturing_ok", char: "🙆‍♂️", name: "OK手势男" },
            { key: "woman_gesturing_ok", char: "🙆‍♀️", name: "OK手势女" },
            { key: "person_tipping_hand", char: "💁", name: "前台" },
            { key: "man_tipping_hand", char: "💁‍♂️", name: "前台男" },
            { key: "woman_tipping_hand", char: "💁‍♀️", name: "前台女" },
            { key: "person_raising_hand", char: "🙋", name: "举手" },
            { key: "man_raising_hand", char: "🙋‍♂️", name: "男生举手" },
            { key: "woman_raising_hand", char: "🙋‍♀️", name: "女生举手" },
            { key: "deaf_person", char: "🧏", name: "失聪者" },
            { key: "deaf_man", char: "🧏‍♂️", name: "失聪的男人" },
            { key: "deaf_woman", char: "🧏‍♀️", name: "失聪的女人" },
            { key: "person_bowing", char: "🙇", name: "鞠躬" },
            { key: "man_bowing", char: "🙇‍♂️", name: "男生鞠躬" },
            { key: "woman_bowing", char: "🙇‍♀️", name: "女生鞠躬" },
            { key: "person_facepalming", char: "🤦", name: "捂脸" },
            { key: "man_facepalming", char: "🤦‍♂️", name: "男生捂脸" },
            { key: "woman_facepalming", char: "🤦‍♀️", name: "女生捂脸" },
            { key: "person_shrugging", char: "🤷", name: "耸肩" },
            { key: "man_shrugging", char: "🤷‍♂️", name: "男生耸肩" },
            { key: "woman_shrugging", char: "🤷‍♀️", name: "女生耸肩" }
          ]
        },
        {
          key: "profession_and_role",
          name: "职业和角色",
          char: "👨‍🍳",
          emojis: [
            { key: "health_worker", char: "🧑‍⚕️", name: "卫生工作者" },
            { key: "man_health_worker", char: "👨‍⚕️", name: "男医生" },
            { key: "woman_health_worker", char: "👩‍⚕️", name: "女医生" },
            { key: "student", char: "🧑‍🎓", name: "学生" },
            { key: "man_student", char: "👨‍🎓", name: "男学生" },
            { key: "woman_student", char: "👩‍🎓", name: "女学生" },
            { key: "teacher", char: "🧑‍🏫", name: "老师" },
            { key: "man_teacher", char: "👨‍🏫", name: "男老师" },
            { key: "woman_teacher", char: "👩‍🏫", name: "女老师" },
            { key: "judge", char: "🧑‍⚖️", name: "法官" },
            { key: "man_judge", char: "👨‍⚖️", name: "男法官" },
            { key: "woman_judge", char: "👩‍⚖️", name: "女法官" },
            { key: "farmer", char: "🧑‍🌾", name: "农民" },
            { key: "man_farmer", char: "👨‍🌾", name: "农夫" },
            { key: "woman_farmer", char: "👩‍🌾", name: "农妇" },
            { key: "cook", char: "🧑‍🍳", name: "厨师" },
            { key: "man_cook", char: "👨‍🍳", name: "男厨师" },
            { key: "woman_cook", char: "👩‍🍳", name: "女厨师" },
            { key: "mechanic", char: "🧑‍🔧", name: "技工" },
            { key: "man_mechanic", char: "👨‍🔧", name: "男技工" },
            { key: "woman_mechanic", char: "👩‍🔧", name: "女技工" },
            { key: "factory_worker", char: "🧑‍🏭", name: "工人" },
            { key: "man_factory_worker", char: "👨‍🏭", name: "男工人" },
            { key: "woman_factory_worker", char: "👩‍🏭", name: "女工人" },
            { key: "office_worker", char: "🧑‍💼", name: "白领" },
            { key: "man_office_worker", char: "👨‍💼", name: "男白领" },
            { key: "woman_office_worker", char: "👩‍💼", name: "女白领" },
            { key: "scientist", char: "🧑‍🔬", name: "科学家" },
            { key: "man_scientist", char: "👨‍🔬", name: "男科学家" },
            { key: "woman_scientist", char: "👩‍🔬", name: "女科学家" },
            { key: "technologist", char: "🧑‍💻", name: "程序员" },
            { key: "man_technologist", char: "👨‍💻", name: "男程序员" },
            { key: "woman_technologist", char: "👩‍💻", name: "女程序员" },
            { key: "singer", char: "🧑‍🎤", name: "歌手" },
            { key: "man_singer", char: "👨‍🎤", name: "男歌手" },
            { key: "woman_singer", char: "👩‍🎤", name: "女歌手" },
            { key: "artist", char: "🧑‍🎨", name: "艺术家" },
            { key: "man_artist", char: "👨‍🎨", name: "男艺术家" },
            { key: "woman_artist", char: "👩‍🎨", name: "女艺术家" },
            { key: "pilot", char: "🧑‍✈️", name: "飞行员" },
            { key: "man_pilot", char: "👨‍✈️", name: "男飞行员" },
            { key: "woman_pilot", char: "👩‍✈️", name: "女飞行员" },
            { key: "astronaut", char: "🧑‍🚀", name: "宇航员" },
            { key: "man_astronaut", char: "👨‍🚀", name: "男宇航员" },
            { key: "woman_astronaut", char: "👩‍🚀", name: "女宇航员" },
            { key: "firefighter", char: "🧑‍🚒", name: "消防员" },
            { key: "man_firefighter", char: "👨‍🚒", name: "男消防员" },
            { key: "woman_firefighter", char: "👩‍🚒", name: "女消防员" },
            { key: "police_officer", char: "👮", name: "警察" },
            { key: "man_police_officer", char: "👮‍♂️", name: "男警察" },
            { key: "woman_police_officer", char: "👮‍♀️", name: "女警察" },
            { key: "detective", char: "🕵", name: "侦探" },
            { key: "man_detective", char: "🕵️‍♂️", name: "男侦探" },
            { key: "woman_detective", char: "🕵️‍♀️", name: "女侦探" },
            { key: "guard", char: "💂", name: "卫兵" },
            { key: "man_guard", char: "💂‍♂️", name: "男卫兵" },
            { key: "woman_guard", char: "💂‍♀️", name: "女卫兵" },
            { key: "ninja", char: "🥷", name: "忍者" },
            { key: "construction_worker", char: "👷", name: "建筑工人" },
            { key: "man_construction_worker", char: "👷‍♂️", name: "男建筑工人" },
            { key: "woman_construction_worker", char: "👷‍♀️", name: "女建筑工人" },
            { key: "person_with_crown", char: "🫅", name: "戴王冠的人" },
            { key: "prince", char: "🤴", name: "王子" },
            { key: "princess", char: "👸", name: "公主" },
            { key: "person_wearing_turban", char: "👳", name: "戴头巾的人" },
            { key: "man_wearing_turban", char: "👳‍♂️", name: "戴头巾的男人" },
            { key: "woman_wearing_turban", char: "👳‍♀️", name: "戴头巾的女人" },
            { key: "person_with_skullcap", char: "👲", name: "戴瓜皮帽的人" },
            { key: "woman_with_headscarf", char: "🧕", name: "带头饰的女人" },
            { key: "person_in_tuxedo", char: "🤵", name: "穿燕尾服的人" },
            { key: "man_in_tuxedo", char: "🤵‍♂️", name: "穿礼服的男人" },
            { key: "woman_in_tuxedo", char: "🤵‍♀️", name: "穿礼服的女人" },
            { key: "person_with_veil", char: "👰", name: "戴头纱的人" },
            { key: "man_with_veil", char: "👰‍♂️", name: "戴头纱的男人" },
            { key: "woman_with_veil", char: "👰‍♀️", name: "戴头纱的女人" },
            { key: "pregnant_woman", char: "🤰", name: "孕妇" },
            { key: "pregnant_man", char: "🫃", name: "怀孕的男人" },
            { key: "pregnant_person", char: "🫄", name: "怀孕的人" },
            { key: "breast_feeding", char: "🤱", name: "母乳喂养" },
            { key: "woman_feeding_baby", char: "👩‍🍼", name: "哺乳的女人" },
            { key: "man_feeding_baby", char: "👨‍🍼", name: "哺乳的男人" },
            { key: "person_feeding_baby", char: "🧑‍🍼", name: "哺乳的人" }
          ]
        },
        {
          key: "fantasy_characters",
          name: "虚构人物",
          char: "🎅",
          emojis: [
            { key: "baby_angel", char: "👼", name: "小天使" },
            { key: "santa_claus", char: "🎅", name: "圣诞老人" },
            { key: "mrs_claus", char: "🤶", name: "圣诞奶奶" },
            { key: "mx_claus", char: "🧑‍🎄", name: "圣诞人" },
            { key: "superhero", char: "🦸", name: "超级英雄" },
            { key: "man_superhero", char: "🦸‍♂️", name: "男超级英雄" },
            { key: "woman_superhero", char: "🦸‍♀️", name: "女超级英雄" },
            { key: "supervillain", char: "🦹", name: "超级大坏蛋" },
            { key: "man_supervillain", char: "🦹‍♂️", name: "男超级大坏蛋" },
            { key: "woman_supervillain", char: "🦹‍♀️", name: "女超级大坏蛋" },
            { key: "mage", char: "🧙", name: "法师" },
            { key: "man_mage", char: "🧙‍♂️", name: "男法师" },
            { key: "woman_mage", char: "🧙‍♀️", name: "女法师" },
            { key: "fairy", char: "🧚", name: "精灵" },
            { key: "man_fairy", char: "🧚‍♂️", name: "仙人" },
            { key: "woman_fairy", char: "🧚‍♀️", name: "仙女" },
            { key: "vampire", char: "🧛", name: "吸血鬼" },
            { key: "man_vampire", char: "🧛‍♂️", name: "男吸血鬼" },
            { key: "woman_vampire", char: "🧛‍♀️", name: "女吸血鬼" },
            { key: "merperson", char: "🧜", name: "人鱼" },
            { key: "merman", char: "🧜‍♂️", name: "男人鱼" },
            { key: "mermaid", char: "🧜‍♀️", name: "美人鱼" },
            { key: "elf", char: "🧝", name: "小精灵" },
            { key: "man_elf", char: "🧝‍♂️", name: "男小精灵" },
            { key: "woman_elf", char: "🧝‍♀️", name: "女小精灵" },
            { key: "genie", char: "🧞", name: "妖怪" },
            { key: "man_genie", char: "🧞‍♂️", name: "男妖怪" },
            { key: "woman_genie", char: "🧞‍♀️", name: "女妖怪" },
            { key: "zombie", char: "🧟", name: "僵尸" },
            { key: "man_zombie", char: "🧟‍♂️", name: "男僵尸" },
            { key: "woman_zombie", char: "🧟‍♀️", name: "女僵尸" },
            { key: "troll", char: "🧌", name: "穴居巨怪" }
          ]
        },
        {
          key: "person_activity",
          name: "人物活动",
          char: "🏃",
          emojis: [
            { key: "person_getting_massage", char: "💆", name: "按摩" },
            { key: "man_getting_massage", char: "💆‍♂️", name: "男生按摩" },
            { key: "woman_getting_massage", char: "💆‍♀️", name: "女生按摩" },
            { key: "person_getting_haircut", char: "💇", name: "理发" },
            { key: "man_getting_haircut", char: "💇‍♂️", name: "男生理发" },
            { key: "woman_getting_haircut", char: "💇‍♀️", name: "女生理发" },
            { key: "person_walking", char: "🚶", name: "行人" },
            { key: "man_walking", char: "🚶‍♂️", name: "男行人" },
            { key: "woman_walking", char: "🚶‍♀️", name: "女行人" },
            { key: "person_standing", char: "🧍", name: "站立者" },
            { key: "man_standing", char: "🧍‍♂️", name: "站立的男人" },
            { key: "woman_standing", char: "🧍‍♀️", name: "站立的女人" },
            { key: "person_kneeling", char: "🧎", name: "下跪者" },
            { key: "man_kneeling", char: "🧎‍♂️", name: "跪下的男人" },
            { key: "woman_kneeling", char: "🧎‍♀️", name: "跪下的女人" },
            { key: "person_with_probing_cane", char: "🧑‍🦯", name: "拄盲杖的人" },
            { key: "man_with_probing_cane", char: "👨‍🦯", name: "拄盲杖的男人" },
            { key: "woman_with_probing_cane", char: "👩‍🦯", name: "拄盲杖的女人" },
            { key: "person_in_motorized_wheelchair", char: "🧑‍🦼", name: "坐电动轮椅的人" },
            { key: "man_in_motorized_wheelchair", char: "👨‍🦼", name: "坐电动轮椅的男人" },
            { key: "woman_in_motorized_wheelchair", char: "👩‍🦼", name: "坐电动轮椅的女人" },
            { key: "person_in_manual_wheelchair", char: "🧑‍🦽", name: "坐手动轮椅的人" },
            { key: "man_in_manual_wheelchair", char: "👨‍🦽", name: "坐手动轮椅的男人" },
            { key: "woman_in_manual_wheelchair", char: "👩‍🦽", name: "坐手动轮椅的女人" },
            { key: "person_running", char: "🏃", name: "跑步者" },
            { key: "man_running", char: "🏃‍♂️", name: "男生跑步" },
            { key: "woman_running", char: "🏃‍♀️", name: "女生跑步" },
            { key: "woman_dancing", char: "💃", name: "跳舞的女人" },
            { key: "man_dancing", char: "🕺", name: "跳舞的男人" },
            { key: "person_in_suit_levitating", char: "🕴", name: "西装革履的人" },
            { key: "people_with_bunny_ears", char: "👯", name: "戴兔耳朵的人" },
            { key: "men_with_bunny_ears", char: "👯‍♂️", name: "兔先生" },
            { key: "women_with_bunny_ears", char: "👯‍♀️", name: "兔女郎" },
            { key: "person_in_steamy_room", char: "🧖", name: "蒸房里的人" },
            { key: "man_in_steamy_room", char: "🧖‍♂️", name: "蒸房里的男人" },
            { key: "woman_in_steamy_room", char: "🧖‍♀️", name: "蒸房里的女人" },
            { key: "person_climbing", char: "🧗", name: "攀爬的人" },
            { key: "man_climbing", char: "🧗‍♂️", name: "攀爬的男人" },
            { key: "woman_climbing", char: "🧗‍♀️", name: "攀爬的女人" }
          ]
        },
        {
          key: "sport",
          name: "运动",
          char: "🚴",
          emojis: [
            { key: "person_fencing", char: "🤺", name: "击剑选手" },
            { key: "horse_racing", char: "🏇", name: "赛马" },
            { key: "skier", char: "⛷", name: "滑雪的人" },
            { key: "snowboarder", char: "🏂", name: "滑雪板" },
            { key: "person_golfing", char: "🏌", name: "打高尔夫的人" },
            { key: "man_golfing", char: "🏌️‍♂️", name: "男生打高尔夫" },
            { key: "woman_golfing", char: "🏌️‍♀️", name: "女生打高尔夫" },
            { key: "person_surfing", char: "🏄", name: "冲浪" },
            { key: "man_surfing", char: "🏄‍♂️", name: "男生冲浪" },
            { key: "woman_surfing", char: "🏄‍♀️", name: "女生冲浪" },
            { key: "person_rowing_boat", char: "🚣", name: "划艇" },
            { key: "man_rowing_boat", char: "🚣‍♂️", name: "男生划船" },
            { key: "woman_rowing_boat", char: "🚣‍♀️", name: "女生划船" },
            { key: "person_swimming", char: "🏊", name: "游泳" },
            { key: "man_swimming", char: "🏊‍♂️", name: "男生游泳" },
            { key: "woman_swimming", char: "🏊‍♀️", name: "女生游泳" },
            { key: "person_bouncing_ball", char: "⛹", name: "玩球" },
            { key: "man_bouncing_ball", char: "⛹️‍♂️", name: "男生玩球" },
            { key: "woman_bouncing_ball", char: "⛹️‍♀️", name: "女生玩球" },
            { key: "person_lifting_weights", char: "🏋", name: "举重" },
            { key: "man_lifting_weights", char: "🏋️‍♂️", name: "男生举重" },
            { key: "woman_lifting_weights", char: "🏋️‍♀️", name: "女生举重" },
            { key: "person_biking", char: "🚴", name: "骑自行车" },
            { key: "man_biking", char: "🚴‍♂️", name: "男生骑自行车" },
            { key: "woman_biking", char: "🚴‍♀️", name: "女生骑自行车" },
            { key: "person_mountain_biking", char: "🚵", name: "骑山地车" },
            { key: "man_mountain_biking", char: "🚵‍♂️", name: "男生骑山地车" },
            { key: "woman_mountain_biking", char: "🚵‍♀️", name: "女生骑山地车" },
            { key: "person_cartwheeling", char: "🤸", name: "侧手翻" },
            { key: "man_cartwheeling", char: "🤸‍♂️", name: "男生侧手翻" },
            { key: "woman_cartwheeling", char: "🤸‍♀️", name: "女生侧手翻" },
            { key: "people_wrestling", char: "🤼", name: "摔跤选手" },
            { key: "men_wrestling", char: "🤼‍♂️", name: "男生摔跤" },
            { key: "women_wrestling", char: "🤼‍♀️", name: "女生摔跤" },
            { key: "person_playing_water_polo", char: "🤽", name: "水球" },
            { key: "man_playing_water_polo", char: "🤽‍♂️", name: "男生玩水球" },
            { key: "woman_playing_water_polo", char: "🤽‍♀️", name: "女生玩水球" },
            { key: "person_playing_handball", char: "🤾", name: "手球" },
            { key: "man_playing_handball", char: "🤾‍♂️", name: "男生玩手球" },
            { key: "woman_playing_handball", char: "🤾‍♀️", name: "女生玩手球" },
            { key: "person_juggling", char: "🤹", name: "抛接杂耍" },
            { key: "man_juggling", char: "🤹‍♂️", name: "男生抛接杂耍" },
            { key: "woman_juggling", char: "🤹‍♀️", name: "女生抛接杂耍" }
          ]
        },
        {
          key: "person_resting",
          name: "人物休息",
          char: "🛌",
          emojis: [
            { key: "person_in_lotus_position", char: "🧘", name: "盘腿的人" },
            { key: "man_in_lotus_position", char: "🧘‍♂️", name: "盘腿的男人" },
            { key: "woman_in_lotus_position", char: "🧘‍♀️", name: "盘腿的女人" },
            { key: "person_taking_bath", char: "🛀", name: "洗澡的人" },
            { key: "person_in_bed", char: "🛌", name: "躺在床上的人" }
          ]
        },
        {
          key: "family_and_couples",
          name: "家庭和情侣",
          char: "👨‍👩‍👧‍👦",
          emojis: [
            { key: "people_holding_hands", char: "🧑‍🤝‍🧑", name: "手拉手的两个人" },
            { key: "women_holding_hands", char: "👭", name: "手拉手的两个女人" },
            { key: "woman_and_man_holding_hands", char: "👫", name: "手拉手的一男一女" },
            { key: "men_holding_hands", char: "👬", name: "手拉手的两个男人" },
            { key: "kiss", char: "💏", name: "亲吻" },
            { key: "kiss_woman_man", char: "👩‍❤️‍💋‍👨", name: "吻：女人和男人" },
            { key: "kiss_man_man", char: "👨‍❤️‍💋‍👨", name: "亲吻：男人和男人" },
            { key: "kiss_woman_woman", char: "👩‍❤️‍💋‍👩", name: "亲吻: 女人女人" },
            { key: "couple_with_heart", char: "💑", name: "情侣" },
            { key: "couple_with_heart_woman_man", char: "👩‍❤️‍👨", name: "带心的夫妇：女人和男人" },
            { key: "couple_with_heart_man_man", char: "👨‍❤️‍👨", name: "带心的夫妇：男人和男人" },
            { key: "couple_with_heart_woman_woman", char: "👩‍❤️‍👩", name: "情侣: 女人女人" },
            { key: "family_man_woman_boy", char: "👨‍👩‍👦", name: "家庭: 男人女人男孩" },
            { key: "family_man_woman_girl", char: "👨‍👩‍👧", name: "家庭: 男人女人女孩" },
            { key: "family_man_woman_girl_boy", char: "👨‍👩‍👧‍👦", name: "家庭: 男人女人女孩男孩" },
            { key: "family_man_woman_boy_boy", char: "👨‍👩‍👦‍👦", name: "家庭: 男人女人男孩男孩" },
            { key: "family_man_woman_girl_girl", char: "👨‍👩‍👧‍👧", name: "家庭: 男人女人女孩女孩" },
            { key: "family_man_man_boy", char: "👨‍👨‍👦", name: "家庭: 男人男人男孩" },
            { key: "family_man_man_girl", char: "👨‍👨‍👧", name: "家庭: 男人男人女孩" },
            { key: "family_man_man_girl_boy", char: "👨‍👨‍👧‍👦", name: "家庭: 男人男人女孩男孩" },
            { key: "family_man_man_boy_boy", char: "👨‍👨‍👦‍👦", name: "家庭: 男人男人男孩男孩" },
            { key: "family_man_man_girl_girl", char: "👨‍👨‍👧‍👧", name: "家庭: 男人男人女孩女孩" },
            { key: "family_woman_woman_boy", char: "👩‍👩‍👦", name: "家庭: 女人女人男孩" },
            { key: "family_woman_woman_girl", char: "👩‍👩‍👧", name: "家庭: 女人女人女孩" },
            { key: "family_woman_woman_girl_boy", char: "👩‍👩‍👧‍👦", name: "家庭: 女人女人女孩男孩" },
            { key: "family_woman_woman_boy_boy", char: "👩‍👩‍👦‍👦", name: "家庭: 女人女人男孩男孩" },
            { key: "family_woman_woman_girl_girl", char: "👩‍👩‍👧‍👧", name: "家庭: 女人女人女孩女孩" },
            { key: "family_man_boy", char: "👨‍👦", name: "家庭: 男人男孩" },
            { key: "family_man_boy_boy", char: "👨‍👦‍👦", name: "家庭: 男人男孩男孩" },
            { key: "family_man_girl", char: "👨‍👧", name: "家庭: 男人女孩" },
            { key: "family_man_girl_boy", char: "👨‍👧‍👦", name: "家庭: 男人女孩男孩" },
            { key: "family_man_girl_girl", char: "👨‍👧‍👧", name: "家庭: 男人女孩女孩" },
            { key: "family_woman_boy", char: "👩‍👦", name: "家庭: 女人男孩" },
            { key: "family_woman_boy_boy", char: "👩‍👦‍👦", name: "家庭: 女人男孩男孩" },
            { key: "family_woman_girl", char: "👩‍👧", name: "家庭: 女人女孩" },
            { key: "family_woman_girl_boy", char: "👩‍👧‍👦", name: "家庭: 女人女孩男孩" },
            { key: "family_woman_girl_girl", char: "👩‍👧‍👧", name: "家庭: 女人女孩女孩" }
          ]
        },
        {
          key: "person_symbol",
          name: "人物符号",
          char: "👣",
          emojis: [
            { key: "family_symbol", char: "👪", name: "家庭" },
            { key: "speaking_head", char: "🗣", name: "说话" },
            { key: "bust_in_silhouette", char: "👤", name: "人像" },
            { key: "busts_in_silhouette", char: "👥", name: "双人像" },
            { key: "people_hugging", char: "🫂", name: "人的拥抱" },
            { key: "footprints", char: "👣", name: "脚印" }
          ]
        },
        {
          key: "skin_tone_and_hair",
          name: "肤色和发型",
          char: "👩🏻‍🦰",
          emojis: [
            { key: "skin_tone_category", char: "👨🏿", name: "肤色", isCategory: true },
            { key: "light_skin_tone", char: "🏻", name: "较浅肤色" },
            { key: "medium_light_skin_tone", char: "🏼", name: "中等-浅肤色" },
            { key: "medium_skin_tone", char: "🏽", name: "中等肤色" },
            { key: "medium_dark_skin_tone", char: "🏾", name: "中等-深肤色" },
            { key: "dark_skin_tone", char: "🏿", name: "较深肤色" },
            { key: "hair_style_category", char: "🧑‍🦱", name: "发型", isCategory: true },
            { key: "red_hair", char: "🦰", name: "红发" },
            { key: "curly_hair", char: "🦱", name: "卷发" },
            { key: "white_hair", char: "🦳", name: "白发" },
            { key: "bald", char: "🦲", name: "秃顶" }
          ]
        }
      ]
    },
    {
      key: "animals_and_nature",
      name: "动物和自然",
      char: "🐵",
      subcategories: [
        {
          key: "mammals",
          name: "哺乳动物",
          char: "🐀",
          emojis: [
            { key: "monkey_face", char: "🐵", name: "猴头" },
            { key: "monkey", char: "🐒", name: "猴子" },
            { key: "gorilla", char: "🦍", name: "大猩猩" },
            { key: "orangutan", char: "🦧", name: "红毛猩猩" },
            { key: "dog_face", char: "🐶", name: "狗脸" },
            { key: "dog", char: "🐕", name: "狗" },
            { key: "guide_dog", char: "🦮", name: "导盲犬" },
            { key: "service_dog", char: "🐕‍🦺", name: "服务犬" },
            { key: "poodle", char: "🐩", name: "贵宾犬" },
            { key: "wolf", char: "🐺", name: "狼" },
            { key: "fox", char: "🦊", name: "狐狸" },
            { key: "raccoon", char: "🦝", name: "浣熊" },
            { key: "cat_face", char: "🐱", name: "猫脸" },
            { key: "cat", char: "🐈", name: "猫" },
            { key: "black_cat", char: "🐈‍⬛", name: "黑猫" },
            { key: "lion", char: "🦁", name: "狮子" },
            { key: "tiger_face", char: "🐯", name: "老虎头" },
            { key: "tiger", char: "🐅", name: "老虎" },
            { key: "leopard", char: "🐆", name: "豹子" },
            { key: "horse_face", char: "🐴", name: "马头" },
            { key: "horse", char: "🐎", name: "马" },
            { key: "unicorn", char: "🦄", name: "独角兽" },
            { key: "zebra", char: "🦓", name: "斑马" },
            { key: "deer", char: "🦌", name: "鹿" },
            { key: "bison", char: "🦬", name: "大野牛" },
            { key: "cow_face", char: "🐮", name: "奶牛头" },
            { key: "ox", char: "🐂", name: "公牛" },
            { key: "water_buffalo", char: "🐃", name: "水牛" },
            { key: "cow", char: "🐄", name: "奶牛" },
            { key: "pig_face", char: "🐷", name: "猪头" },
            { key: "pig", char: "🐖", name: "猪" },
            { key: "boar", char: "🐗", name: "野猪" },
            { key: "pig_nose", char: "🐽", name: "猪鼻子" },
            { key: "ram", char: "🐏", name: "公羊" },
            { key: "ewe", char: "🐑", name: "母羊" },
            { key: "goat", char: "🐐", name: "山羊" },
            { key: "camel", char: "🐪", name: "骆驼" },
            { key: "two_hump_camel", char: "🐫", name: "双峰骆驼" },
            { key: "llama", char: "🦙", name: "美洲鸵" },
            { key: "giraffe", char: "🦒", name: "长颈鹿" },
            { key: "elephant", char: "🐘", name: "大象" },
            { key: "mammoth", char: "🦣", name: "猛犸" },
            { key: "rhinoceros", char: "🦏", name: "犀牛" },
            { key: "hippopotamus", char: "🦛", name: "河马" },
            { key: "mouse_face", char: "🐭", name: "老鼠头" },
            { key: "mouse", char: "🐁", name: "老鼠" },
            { key: "rat", char: "🐀", name: "耗子" },
            { key: "hamster", char: "🐹", name: "仓鼠" },
            { key: "rabbit_face", char: "🐰", name: "兔子头" },
            { key: "rabbit", char: "🐇", name: "兔子" },
            { key: "chipmunk", char: "🐿", name: "松鼠" },
            { key: "beaver", char: "🦫", name: "海狸" },
            { key: "hedgehog", char: "🦔", name: "刺猬" },
            { key: "bat", char: "🦇", name: "蝙蝠" },
            { key: "bear", char: "🐻", name: "熊" },
            { key: "polar_bear", char: "🐻‍❄️", name: "北极熊" },
            { key: "koala", char: "🐨", name: "考拉" },
            { key: "panda", char: "🐼", name: "熊猫" },
            { key: "sloth", char: "🦥", name: "树懒" },
            { key: "otter", char: "🦦", name: "水獭" },
            { key: "skunk", char: "🦨", name: "臭鼬" },
            { key: "kangaroo", char: "🦘", name: "袋鼠" },
            { key: "badger", char: "🦡", name: "獾" },
            { key: "paw_prints", char: "🐾", name: "爪印" }
          ]
        },
        {
          key: "birds",
          name: "鸟类",
          char: "🐓",
          emojis: [
            { key: "turkey", char: "🦃", name: "火鸡" },
            { key: "chicken", char: "🐔", name: "鸡" },
            { key: "rooster", char: "🐓", name: "公鸡" },
            { key: "hatching_chick", char: "🐣", name: "小鸡破壳" },
            { key: "baby_chick", char: "🐤", name: "小鸡" },
            { key: "front_facing_baby_chick", char: "🐥", name: "正面朝向的小鸡" },
            { key: "bird", char: "🐦", name: "鸟" },
            { key: "penguin", char: "🐧", name: "企鹅" },
            { key: "dove", char: "🕊", name: "鸽" },
            { key: "eagle", char: "🦅", name: "鹰" },
            { key: "duck", char: "🦆", name: "鸭子" },
            { key: "swan", char: "🦢", name: "天鹅" },
            { key: "owl", char: "🦉", name: "猫头鹰" },
            { key: "dodo", char: "🦤", name: "渡渡鸟" },
            { key: "feather", char: "🪶", name: "羽毛" },
            { key: "flamingo", char: "🦩", name: "火烈鸟" },
            { key: "peacock", char: "🦚", name: "孔雀" },
            { key: "parrot", char: "🦜", name: "鹦鹉" }
          ]
        },
        {
          key: "amphibians",
          name: "两栖动物",
          char: "🐸",
          emojis: [
            { key: "frog", char: "🐸", name: "青蛙" }
          ]
        },
        {
          key: "reptiles",
          name: "爬行动物",
          char: "🐍",
          emojis: [
            { key: "crocodile", char: "🐊", name: "鳄鱼" },
            { key: "turtle", char: "🐢", name: "龟" },
            { key: "lizard", char: "🦎", name: "蜥蜴" },
            { key: "snake", char: "🐍", name: "蛇" },
            { key: "dragon_face", char: "🐲", name: "龙头" },
            { key: "dragon", char: "🐉", name: "龙" },
            { key: "sauropod", char: "🦕", name: "蜥蜴类" },
            { key: "t_rex", char: "🦖", name: "霸王龙" }
          ]
        },
        {
          key: "marine_life",
          name: "海洋生物",
          char: "🐟",
          emojis: [
            { key: "spouting_whale", char: "🐳", name: "喷水的鲸" },
            { key: "whale", char: "🐋", name: "鲸鱼" },
            { key: "dolphin", char: "🐬", name: "海豚" },
            { key: "seal", char: "🦭", name: "海豹" },
            { key: "fish", char: "🐟", name: "鱼" },
            { key: "tropical_fish", char: "🐠", name: "热带鱼" },
            { key: "blowfish", char: "🐡", name: "河豚" },
            { key: "shark", char: "🦈", name: "鲨鱼" },
            { key: "octopus", char: "🐙", name: "章鱼" },
            { key: "spiral_shell", char: "🐚", name: "海螺" },
            { key: "coral", char: "🪸", name: "珊瑚" },
            { key: "crab", char: "🦀", name: "蟹" },
            { key: "lobster", char: "🦞", name: "龙虾" },
            { key: "shrimp", char: "🦐", name: "虾" },
            { key: "squid", char: "🦑", name: "乌贼" },
            { key: "oyster", char: "🦪", name: "牡蛎" }
          ]
        },
        {
          key: "insects",
          name: "昆虫",
          char: "🐛",
          emojis: [
            { key: "snail", char: "🐌", name: "蜗牛" },
            { key: "butterfly", char: "🦋", name: "蝴蝶" },
            { key: "caterpillar", char: "🐛", name: "毛毛虫" },
            { key: "ant", char: "🐜", name: "蚂蚁" },
            { key: "honeybee", char: "🐝", name: "蜜蜂" },
            { key: "beetle", char: "🪲", name: "甲虫" },
            { key: "lady_beetle", char: "🐞", name: "瓢虫" },
            { key: "cricket", char: "🦗", name: "蟋蟀" },
            { key: "cockroach", char: "🪳", name: "蟑螂" },
            { key: "spider", char: "🕷", name: "蜘蛛" },
            { key: "spider_web", char: "🕸", name: "蜘蛛网" },
            { key: "scorpion", char: "🦂", name: "蝎子" },
            { key: "mosquito", char: "🦟", name: "蚊子" },
            { key: "fly", char: "🪰", name: "苍蝇" },
            { key: "worm", char: "🪱", name: "蠕虫" },
            { key: "bacteria", char: "🦠", name: "细菌" }
          ]
        },
        {
          key: "flowers",
          name: "花朵",
          char: "🌹",
          emojis: [
            { key: "bouquet", char: "💐", name: "花束" },
            { key: "cherry_blossom", char: "🌸", name: "樱花" },
            { key: "white_flower", char: "💮", name: "白花" },
            { key: "lotus", char: "🪷", name: "莲花" },
            { key: "rosette", char: "🏵", name: "圆形花饰" },
            { key: "rose", char: "🌹", name: "玫瑰" },
            { key: "wilted_flower", char: "🥀", name: "枯萎的花" },
            { key: "hibiscus", char: "🌺", name: "芙蓉" },
            { key: "sunflower", char: "🌻", name: "向日葵" },
            { key: "blossom", char: "🌼", name: "开花" },
            { key: "tulip", char: "🌷", name: "郁金香" }
          ]
        },
        {
          key: "other_plants",
          name: "其他植物",
          char: "🌴",
          emojis: [
            { key: "seedling", char: "🌱", name: "幼苗" },
            { key: "potted_plant", char: "🪴", name: "盆栽植物" },
            { key: "evergreen_tree", char: "🌲", name: "松树" },
            { key: "deciduous_tree", char: "🌳", name: "落叶树" },
            { key: "palm_tree", char: "🌴", name: "棕榈树" },
            { key: "cactus", char: "🌵", name: "仙人掌" },
            { key: "sheaf_of_rice", char: "🌾", name: "稻子" },
            { key: "herb", char: "🌿", name: "药草" },
            { key: "shamrock", char: "☘", name: "三叶草" },
            { key: "four_leaf_clover", char: "🍀", name: "四叶草" },
            { key: "maple_leaf", char: "🍁", name: "枫叶" },
            { key: "fallen_leaf", char: "🍂", name: "落叶" },
            { key: "leaf_fluttering_in_wind", char: "🍃", name: "风吹叶落" },
            { key: "empty_nest", char: "🪹", name: "空巢" },
            { key: "nest_with_eggs", char: "🪺", name: "有蛋的巢" },
            { key: "mushroom", char: "🍄", name: "蘑菇" }
          ]
        }
      ]
    },
    {
      key: "food_and_drink",
      name: "食物和饮料",
      char: "🍓",
      subcategories: [
        {
          key: "fruits",
          name: "水果",
          char: "🍅",
          emojis: [
            { key: "grapes", char: "🍇", name: "葡萄" },
            { key: "melon", char: "🍈", name: "甜瓜" },
            { key: "watermelon", char: "🍉", name: "西瓜" },
            { key: "tangerine", char: "🍊", name: "橘子" },
            { key: "lemon", char: "🍋", name: "柠檬" },
            { key: "banana", char: "🍌", name: "香蕉" },
            { key: "pineapple", char: "🍍", name: "菠萝" },
            { key: "mango", char: "🥭", name: "芒果" },
            { key: "red_apple", char: "🍎", name: "红苹果" },
            { key: "green_apple", char: "🍏", name: "青苹果" },
            { key: "pear", char: "🍐", name: "梨" },
            { key: "peach", char: "🍑", name: "桃" },
            { key: "cherries", char: "🍒", name: "樱桃" },
            { key: "strawberry", char: "🍓", name: "草莓" },
            { key: "blueberries", char: "🫐", name: "蓝莓" },
            { key: "kiwi_fruit", char: "🥝", name: "猕猴桃" },
            { key: "tomato", char: "🍅", name: "西红柿" },
            { key: "olive", char: "🫒", name: "橄榄" },
            { key: "coconut", char: "🥥", name: "椰子" }
          ]
        },
        {
          key: "vegetables",
          name: "蔬菜",
          char: "🥬",
          emojis: [
            { key: "avocado", char: "🥑", name: "鳄梨" },
            { key: "eggplant", char: "🍆", name: "茄子" },
            { key: "potato", char: "🥔", name: "土豆" },
            { key: "carrot", char: "🥕", name: "胡萝卜" },
            { key: "ear_of_corn", char: "🌽", name: "玉米" },
            { key: "hot_pepper", char: "🌶", name: "红辣椒" },
            { key: "bell_pepper", char: "🫑", name: "灯笼椒" },
            { key: "cucumber", char: "🥒", name: "黄瓜" },
            { key: "leafy_greens", char: "🥬", name: "绿叶蔬菜" },
            { key: "broccoli", char: "🥦", name: "西兰花" },
            { key: "garlic", char: "🧄", name: "蒜" },
            { key: "onion", char: "🧅", name: "洋葱" },
            { key: "peanuts", char: "🥜", name: "花生" },
            { key: "beans", char: "🫘", name: "豆" },
            { key: "chestnut", char: "🌰", name: "栗子" }
          ]
        },
        {
          key: "prepared_food",
          name: "熟食",
          char: "🍕",
          emojis: [
            { key: "bread", char: "🍞", name: "面包" },
            { key: "croissant", char: "🥐", name: "羊角面包" },
            { key: "baguette_bread", char: "🥖", name: "法式长棍面包" },
            { key: "flatbread", char: "🫓", name: "扁面包" },
            { key: "pretzel", char: "🥨", name: "椒盐卷饼" },
            { key: "bagel", char: "🥯", name: "面包圈" },
            { key: "pancakes", char: "🥞", name: "烙饼" },
            { key: "waffle", char: "🧇", name: "华夫饼" },
            { key: "cheese_wedge", char: "🧀", name: "芝士" },
            { key: "meat_on_bone", char: "🍖", name: "排骨" },
            { key: "poultry_leg", char: "🍗", name: "家禽的腿" },
            { key: "cut_of_meat", char: "🥩", name: "肉块" },
            { key: "bacon", char: "🥓", name: "培根" },
            { key: "hamburger", char: "🍔", name: "汉堡" },
            { key: "french_fries", char: "🍟", name: "薯条" },
            { key: "pizza", char: "🍕", name: "披萨" },
            { key: "hot_dog", char: "🌭", name: "热狗" },
            { key: "sandwich", char: "🥪", name: "三明治" },
            { key: "taco", char: "🌮", name: "墨西哥卷饼" },
            { key: "burrito", char: "🌯", name: "墨西哥玉米煎饼" },
            { key: "tamale", char: "🫔", name: "墨西哥粽子" },
            { key: "stuffed_flatbread", char: "🥙", name: "夹心饼" },
            { key: "falafel", char: "🧆", name: "炸豆丸子" },
            { key: "egg", char: "🥚", name: "蛋" },
            { key: "cooking", char: "🍳", name: "煎蛋" },
            { key: "shallow_pan_of_food", char: "🥘", name: "装有食物的浅底锅" },
            { key: "pot_of_food", char: "🍲", name: "一锅食物" },
            { key: "fondue", char: "🫕", name: "奶酪火锅" },
            { key: "bowl_with_spoon", char: "🥣", name: "碗勺" },
            { key: "green_salad", char: "🥗", name: "绿色沙拉" },
            { key: "popcorn", char: "🍿", name: "爆米花" },
            { key: "butter", char: "🧈", name: "黄油" },
            { key: "salt", char: "🧂", name: "盐" },
            { key: "canned_food", char: "🥫", name: "罐头食品" }
          ]
        },
        {
          key: "asian_food",
          name: "亚洲食物",
          char: "🍚",
          emojis: [
            { key: "bento_box", char: "🍱", name: "盒饭" },
            { key: "rice_cracker", char: "🍘", name: "米饼" },
            { key: "rice_ball", char: "🍙", name: "饭团" },
            { key: "cooked_rice", char: "🍚", name: "米饭" },
            { key: "curry_rice", char: "🍛", name: "咖喱饭" },
            { key: "steaming_bowl", char: "🍜", name: "面条" },
            { key: "spaghetti", char: "🍝", name: "意粉" },
            { key: "roasted_sweet_potato", char: "🍠", name: "烤红薯" },
            { key: "oden", char: "🍢", name: "关东煮" },
            { key: "sushi", char: "🍣", name: "寿司" },
            { key: "fried_shrimp", char: "🍤", name: "天妇罗" },
            { key: "fish_cake_with_swirl", char: "🍥", name: "鱼板" },
            { key: "moon_cake", char: "🥮", name: "月饼" },
            { key: "dango", char: "🍡", name: "团子" },
            { key: "dumpling", char: "🥟", name: "饺子" },
            { key: "fortune_cookie", char: "🥠", name: "幸运饼干" },
            { key: "takeout_box", char: "🥡", name: "外卖盒" }
          ]
        },
        {
          key: "desserts",
          name: "甜点",
          char: "🍦",
          emojis: [
            { key: "soft_ice_cream", char: "🍦", name: "圆筒冰激凌" },
            { key: "shaved_ice", char: "🍧", name: "刨冰" },
            { key: "ice_cream", char: "🍨", name: "冰淇淋" },
            { key: "doughnut", char: "🍩", name: "甜甜圈" },
            { key: "cookie", char: "🍪", name: "饼干" },
            { key: "birthday_cake", char: "🎂", name: "生日蛋糕" },
            { key: "shortcake", char: "🍰", name: "水果蛋糕" },
            { key: "cupcake", char: "🧁", name: "纸杯蛋糕" },
            { key: "pie", char: "🥧", name: "派" },
            { key: "chocolate_bar", char: "🍫", name: "巧克力" },
            { key: "candy", char: "🍬", name: "糖" },
            { key: "lollipop", char: "🍭", name: "棒棒糖" },
            { key: "custard", char: "🍮", name: "奶黄" },
            { key: "honey_pot", char: "🍯", name: "蜂蜜" }
          ]
        },
        {
          key: "drinks",
          name: "饮料",
          char: "☕️",
          emojis: [
            { key: "baby_bottle", char: "🍼", name: "奶瓶" },
            { key: "glass_of_milk", char: "🥛", name: "一杯奶" },
            { key: "hot_beverage", char: "☕", name: "热饮" },
            { key: "teapot", char: "🫖", name: "茶壶" },
            { key: "teacup_without_handle", char: "🍵", name: "热茶" },
            { key: "sake", char: "🍶", name: "清酒" },
            { key: "champagne_bottle", char: "🍾", name: "开香槟" },
            { key: "wine_glass", char: "🍷", name: "葡萄酒" },
            { key: "cocktail_glass", char: "🍸", name: "鸡尾酒" },
            { key: "tropical_drink", char: "🍹", name: "热带水果饮料" },
            { key: "beer_mug", char: "🍺", name: "啤酒" },
            { key: "clinking_beer_mugs", char: "🍻", name: "干杯" },
            { key: "clinking_glasses", char: "🥂", name: "碰杯" },
            { key: "tumbler_glass", char: "🥃", name: "平底杯" },
            { key: "pouring_liquid", char: "🫗", name: "倾倒液体" },
            { key: "cup_with_straw", char: "🥤", name: "带吸管杯" },
            { key: "bubble_tea", char: "🧋", name: "珍珠奶茶" },
            { key: "beverage_box", char: "🧃", name: "饮料盒" },
            { key: "mate", char: "🧉", name: "马黛茶" },
            { key: "ice", char: "🧊", name: "冰块" }
          ]
        },
        {
          key: "tableware",
          name: "餐具",
          char: "🍴",
          emojis: [
            { key: "chopsticks", char: "🥢", name: "筷子" },
            { key: "fork_and_knife_with_plate", char: "🍽", name: "餐具" },
            { key: "fork_and_knife", char: "🍴", name: "刀叉" },
            { key: "spoon", char: "🥄", name: "匙" },
            { key: "kitchen_knife", char: "🔪", name: "菜刀" },
            { key: "jar", char: "🫙", name: "罐" },
            { key: "amphora", char: "🏺", name: "双耳瓶" }
          ]
        }
      ]
    },
    {
      key: "travel_and_places",
      name: "旅行和地点",
      char: "🚌",
      subcategories: [
        {
          key: "maps",
          name: "地图",
          char: "🌍️",
          emojis: [
            { key: "globe_showing_europe_africa", char: "🌍", name: "地球上的欧洲非洲" },
            { key: "globe_showing_americas", char: "🌎", name: "地球上的美洲" },
            { key: "globe_showing_asia_australia", char: "🌏", name: "地球上的亚洲澳洲" },
            { key: "globe_with_meridians", char: "🌐", name: "带经纬线的地球" },
            { key: "world_map", char: "🗺", name: "世界地图" },
            { key: "map_of_japan", char: "🗾", name: "日本地图" },
            { key: "compass", char: "🧭", name: "指南针" }
          ]
        },
        {
          key: "nature_scenery",
          name: "自然风光",
          char: "🌋",
          emojis: [
            { key: "snow_capped_mountain", char: "🏔", name: "雪山" },
            { key: "mountain", char: "⛰", name: "山" },
            { key: "volcano", char: "🌋", name: "火山" },
            { key: "mount_fuji", char: "🗻", name: "富士山" },
            { key: "camping", char: "🏕", name: "露营" },
            { key: "beach_with_umbrella", char: "🏖", name: "沙滩伞" },
            { key: "desert", char: "🏜", name: "沙漠" },
            { key: "desert_island", char: "🏝", name: "无人荒岛" },
            { key: "national_park", char: "🏞", name: "国家公园" }
          ]
        },
        {
          key: "buildings",
          name: "建筑",
          char: "🏗️",
          emojis: [
            { key: "stadium", char: "🏟", name: "体育馆" },
            { key: "classical_building", char: "🏛", name: "古典建筑" },
            { key: "building_construction", char: "🏗", name: "施工" },
            { key: "brick", char: "🧱", name: "砖" },
            { key: "rock", char: "🪨", name: "岩石" },
            { key: "wood", char: "🪵", name: "木头" },
            { key: "hut", char: "🛖", name: "小屋" },
            { key: "houses", char: "🏘", name: "房屋建筑" },
            { key: "derelict_house", char: "🏚", name: "废墟" },
            { key: "house", char: "🏠", name: "房子" },
            { key: "house_with_garden", char: "🏡", name: "别墅" },
            { key: "office_building", char: "🏢", name: "办公楼" },
            { key: "japanese_post_office", char: "🏣", name: "日本邮局" },
            { key: "post_office", char: "🏤", name: "邮局" },
            { key: "hospital", char: "🏥", name: "医院" },
            { key: "bank", char: "🏦", name: "银行" },
            { key: "hotel", char: "🏨", name: "酒店" },
            { key: "love_hotel", char: "🏩", name: "情人酒店" },
            { key: "convenience_store", char: "🏪", name: "便利店" },
            { key: "school", char: "🏫", name: "学校" },
            { key: "department_store", char: "🏬", name: "商场" },
            { key: "factory", char: "🏭", name: "工厂" },
            { key: "japanese_castle", char: "🏯", name: "日本城堡" },
            { key: "european_castle", char: "🏰", name: "欧洲城堡" },
            { key: "wedding", char: "💒", name: "婚礼" },
            { key: "tokyo_tower", char: "🗼", name: "东京塔" },
            { key: "statue_of_liberty", char: "🗽", name: "自由女神像" }
          ]
        },
        {
          key: "religious_places",
          name: "宗教场所",
          char: "⛪️",
          emojis: [
            { key: "church", char: "⛪", name: "教堂" },
            { key: "mosque", char: "🕌", name: "清真寺" },
            { key: "hindu_temple", char: "🛕", name: "印度寺庙" },
            { key: "synagogue", char: "🕍", name: "犹太教堂" },
            { key: "shinto_shrine", char: "⛩", name: "神社" },
            { key: "kaaba", char: "🕋", name: "克尔白" }
          ]
        },
        {
          key: "other_places",
          name: "其他地点",
          char: "⛲️",
          emojis: [
            { key: "fountain", char: "⛲", name: "喷泉" },
            { key: "tent", char: "⛺", name: "帐篷" },
            { key: "foggy", char: "🌁", name: "有雾" },
            { key: "night_with_stars", char: "🌃", name: "夜晚" },
            { key: "cityscape", char: "🏙", name: "城市风光" },
            { key: "sunrise_over_mountains", char: "🌄", name: "山顶日出" },
            { key: "sunrise", char: "🌅", name: "日出" },
            { key: "cityscape_at_dusk", char: "🌆", name: "城市黄昏" },
            { key: "sunset", char: "🌇", name: "日落" },
            { key: "bridge_at_night", char: "🌉", name: "夜幕下的桥" },
            { key: "hot_springs", char: "♨", name: "温泉" },
            { key: "carousel_horse", char: "🎠", name: "旋转木马" },
            { key: "playground_slide", char: "🛝", name: "游乐场滑梯" },
            { key: "ferris_wheel", char: "🎡", name: "摩天轮" },
            { key: "roller_coaster", char: "🎢", name: "过山车" },
            { key: "barber_pole", char: "💈", name: "理发店" },
            { key: "circus_tent", char: "🎪", name: "马戏团帐篷" }
          ]
        },
        {
          key: "land_transport",
          name: "陆路交通",
          char: "⛽️",
          emojis: [
            { key: "steam_locomotive", char: "🚂", name: "蒸汽火车" },
            { key: "railway_car", char: "🚃", name: "轨道车" },
            { key: "high_speed_train", char: "🚄", name: "高速列车" },
            { key: "bullet_train", char: "🚅", name: "子弹头高速列车" },
            { key: "train", char: "🚆", name: "火车" },
            { key: "metro", char: "🚇", name: "地铁" },
            { key: "light_rail", char: "🚈", name: "轻轨" },
            { key: "station", char: "🚉", name: "车站" },
            { key: "tram", char: "🚊", name: "路面电车" },
            { key: "monorail", char: "🚝", name: "单轨" },
            { key: "mountain_railway", char: "🚞", name: "山区铁路" },
            { key: "tram_car", char: "🚋", name: "有轨电车" },
            { key: "bus", char: "🚌", name: "公交车" },
            { key: "oncoming_bus", char: "🚍", name: "迎面驶来的公交车" },
            { key: "trolleybus", char: "🚎", name: "无轨电车" },
            { key: "minibus", char: "🚐", name: "小巴" },
            { key: "ambulance", char: "🚑", name: "救护车" },
            { key: "fire_engine", char: "🚒", name: "消防车" },
            { key: "police_car", char: "🚓", name: "警车" },
            { key: "oncoming_police_car", char: "🚔", name: "迎面驶来的警车" },
            { key: "taxi", char: "🚕", name: "出租车" },
            { key: "oncoming_taxi", char: "🚖", name: "迎面驶来的出租车" },
            { key: "automobile", char: "🚗", name: "汽车" },
            { key: "oncoming_automobile", char: "🚘", name: "迎面驶来的汽车" },
            { key: "sport_utility_vehicle", char: "🚙", name: "运动型多用途车" },
            { key: "pickup_truck", char: "🛻", name: "敞蓬小型载货卡车" },
            { key: "delivery_truck", char: "🚚", name: "货车" },
            { key: "articulated_lorry", char: "🚛", name: "铰接式货车" },
            { key: "tractor", char: "🚜", name: "拖拉机" },
            { key: "racing_car", char: "🏎", name: "赛车" },
            { key: "motorcycle", char: "🏍", name: "摩托车" },
            { key: "motor_scooter", char: "🛵", name: "小型摩托车" },
            { key: "manual_wheelchair", char: "🦽", name: "手动轮椅" },
            { key: "motorized_wheelchair", char: "🦼", name: "电动轮椅" },
            { key: "auto_rickshaw", char: "🛺", name: "三轮摩托车" },
            { key: "bicycle", char: "🚲", name: "自行车" },
            { key: "kick_scooter", char: "🛴", name: "滑板车" },
            { key: "skateboard", char: "🛹", name: "滑板" },
            { key: "roller_skate", char: "🛼", name: "四轮滑冰鞋" },
            { key: "bus_stop", char: "🚏", name: "公交车站" },
            { key: "motorway", char: "🛣", name: "高速公路" },
            { key: "railway_track", char: "🛤", name: "铁轨" },
            { key: "oil_drum", char: "🛢", name: "石油桶" },
            { key: "fuel_pump", char: "⛽", name: "油泵" },
            { key: "wheel", char: "🛞", name: "车轮" },
            { key: "police_car_light", char: "🚨", name: "警车灯" },
            { key: "horizontal_traffic_light", char: "🚥", name: "横向的红绿灯" },
            { key: "vertical_traffic_light", char: "🚦", name: "纵向的红绿灯" },
            { key: "stop_sign", char: "🛑", name: "停止标志" },
            { key: "construction", char: "🚧", name: "路障" }
          ]
        },
        {
          key: "water_transport",
          name: "水路交通",
          char: "🚢",
          emojis: [
            { key: "anchor", char: "⚓", name: "锚" },
            { key: "ring_buoy", char: "🛟", name: "救生圈" },
            { key: "sailboat", char: "⛵", name: "帆船" },
            { key: "canoe", char: "🛶", name: "独木舟" },
            { key: "speedboat", char: "🚤", name: "快艇" },
            { key: "passenger_ship", char: "🛳", name: "客轮" },
            { key: "ferry", char: "⛴", name: "渡轮" },
            { key: "motor_boat", char: "🛥", name: "摩托艇" },
            { key: "ship", char: "🚢", name: "船" }
          ]
        },
        {
          key: "air_transport",
          name: "航空交通",
          char: "✈️",
          emojis: [
            { key: "airplane", char: "✈", name: "飞机" },
            { key: "small_airplane", char: "🛩", name: "小型飞机" },
            { key: "airplane_departure", char: "🛫", name: "航班起飞" },
            { key: "airplane_arrival", char: "🛬", name: "航班降落" },
            { key: "parachute", char: "🪂", name: "降落伞" },
            { key: "seat", char: "💺", name: "座位" },
            { key: "helicopter", char: "🚁", name: "直升机" },
            { key: "suspension_railway", char: "🚟", name: "空轨" },
            { key: "mountain_cableway", char: "🚠", name: "缆车" },
            { key: "aerial_tramway", char: "🚡", name: "索道" },
            { key: "satellite", char: "🛰", name: "卫星" },
            { key: "rocket", char: "🚀", name: "火箭" },
            { key: "flying_saucer", char: "🛸", name: "飞碟" }
          ]
        },
        {
          key: "hotel",
          name: "酒店",
          char: "🛎️",
          emojis: [
            { key: "bellhop_bell", char: "🛎", name: "服务铃" },
            { key: "luggage", char: "🧳", name: "行李箱" }
          ]
        },
        {
          key: "time",
          name: "时间",
          char: "⌚️",
          emojis: [
            { key: "hourglass_done", char: "⌛", name: "沙漏" },
            { key: "hourglass_not_done", char: "⏳", name: "沙正往下流的沙漏" },
            { key: "watch", char: "⌚", name: "手表" },
            { key: "alarm_clock", char: "⏰", name: "闹钟" },
            { key: "stopwatch", char: "⏱", name: "秒表" },
            { key: "timer_clock", char: "⏲", name: "定时器" },
            { key: "mantelpiece_clock", char: "🕰", name: "座钟" },
            { key: "twelve_oclock", char: "🕛", name: "十二点" },
            { key: "twelve_thirty", char: "🕧", name: "十二点半" },
            { key: "one_oclock", char: "🕐", name: "一点" },
            { key: "one_thirty", char: "🕜", name: "一点半" },
            { key: "two_oclock", char: "🕑", name: "两点" },
            { key: "two_thirty", char: "🕝", name: "两点半" },
            { key: "three_oclock", char: "🕒", name: "三点" },
            { key: "three_thirty", char: "🕞", name: "三点半" },
            { key: "four_oclock", char: "🕓", name: "四点" },
            { key: "four_thirty", char: "🕟", name: "四点半" },
            { key: "five_oclock", char: "🕔", name: "五点" },
            { key: "five_thirty", char: "🕠", name: "五点半" },
            { key: "six_oclock", char: "🕕", name: "六点" },
            { key: "six_thirty", char: "🕡", name: "六点半" },
            { key: "seven_oclock", char: "🕖", name: "七点" },
            { key: "seven_thirty", char: "🕢", name: "七点半" },
            { key: "eight_oclock", char: "🕗", name: "八点" },
            { key: "eight_thirty", char: "🕣", name: "八点半" },
            { key: "nine_oclock", char: "🕘", name: "九点" },
            { key: "nine_thirty", char: "🕤", name: "九点半" },
            { key: "ten_oclock", char: "🕙", name: "十点" },
            { key: "ten_thirty", char: "🕥", name: "十点半" },
            { key: "eleven_oclock", char: "🕚", name: "十一点" },
            { key: "eleven_thirty", char: "🕦", name: "十一点半" }
          ]
        },
        {
          key: "sky_and_weather",
          name: "天空和天气",
          char: "☂️",
          emojis: [
            { key: "new_moon", char: "🌑", name: "朔月" },
            { key: "waxing_crescent_moon", char: "🌒", name: "蛾眉月" },
            { key: "first_quarter_moon", char: "🌓", name: "上弦月" },
            { key: "waxing_gibbous_moon", char: "🌔", name: "盈凸月" },
            { key: "full_moon", char: "🌕", name: "满月" },
            { key: "waning_gibbous_moon", char: "🌖", name: "亏凸月" },
            { key: "last_quarter_moon", char: "🌗", name: "下弦月" },
            { key: "waning_crescent_moon", char: "🌘", name: "残月" },
            { key: "crescent_moon", char: "🌙", name: "弯月" },
            { key: "new_moon_face", char: "🌚", name: "微笑的朔月" },
            { key: "first_quarter_moon_face", char: "🌛", name: "微笑的上弦月" },
            { key: "last_quarter_moon_face", char: "🌜", name: "微笑的下弦月" },
            { key: "thermometer", char: "🌡", name: "温度计" },
            { key: "sun", char: "☀", name: "太阳" },
            { key: "full_moon_face", char: "🌝", name: "微笑的月亮" },
            { key: "sun_with_face", char: "🌞", name: "微笑的太阳" },
            { key: "ringed_planet", char: "🪐", name: "有环行星" },
            { key: "star", char: "⭐", name: "星星" },
            { key: "glowing_star", char: "🌟", name: "闪亮的星星" },
            { key: "shooting_star", char: "🌠", name: "流星" },
            { key: "milky_way", char: "🌌", name: "银河" },
            { key: "cloud", char: "☁", name: "云" },
            { key: "sun_behind_cloud", char: "⛅", name: "阴" },
            { key: "cloud_with_lightning_and_rain", char: "⛈", name: "雷阵雨" },
            { key: "sun_behind_small_cloud", char: "🌤", name: "晴偶有云" },
            { key: "sun_behind_large_cloud", char: "🌥", name: "多云" },
            { key: "sun_behind_rain_cloud", char: "🌦", name: "晴转雨" },
            { key: "cloud_with_rain", char: "🌧", name: "下雨" },
            { key: "cloud_with_snow", char: "🌨", name: "下雪" },
            { key: "cloud_with_lightning", char: "🌩", name: "打雷" },
            { key: "tornado", char: "🌪", name: "龙卷风" },
            { key: "fog", char: "🌫", name: "雾" },
            { key: "wind_face", char: "🌬", name: "大风" },
            { key: "cyclone", char: "🌀", name: "台风" },
            { key: "rainbow", char: "🌈", name: "彩虹" },
            { key: "closed_umbrella", char: "🌂", name: "收起的伞" },
            { key: "umbrella", char: "☂", name: "伞" },
            { key: "umbrella_with_rain_drops", char: "☔", name: "雨伞" },
            { key: "umbrella_on_ground", char: "⛱", name: "阳伞" },
            { key: "high_voltage", char: "⚡", name: "高压" },
            { key: "snowflake", char: "❄", name: "雪花" },
            { key: "snowman_with_snow", char: "☃", name: "雪与雪人" },
            { key: "snowman_without_snow", char: "⛄", name: "雪人" },
            { key: "comet", char: "☄", name: "彗星" },
            { key: "fire", char: "🔥", name: "火焰" },
            { key: "droplet", char: "💧", name: "水滴" },
            { key: "water_wave", char: "🌊", name: "浪花" }
          ]
        }
      ]
    },
    {
      key: "activities",
      name: "活动",
      char: "⚽️",
      subcategories: [
        {
          key: "festival",
          name: "节日",
          char: "🎈",
          emojis: [
            { key: "jack_o_lantern", char: "🎃", name: "南瓜灯" },
            { key: "christmas_tree", char: "🎄", name: "圣诞树" },
            { key: "fireworks", char: "🎆", name: "焰火" },
            { key: "sparkler", char: "🎇", name: "烟花" },
            { key: "firecracker", char: "🧨", name: "爆竹" },
            { key: "sparkles", char: "✨", name: "闪亮" },
            { key: "balloon", char: "🎈", name: "气球" },
            { key: "party_popper", char: "🎉", name: "拉炮彩带" },
            { key: "confetti_ball", char: "🎊", name: "五彩纸屑球" },
            { key: "tanabata_tree", char: "🎋", name: "七夕树" },
            { key: "pine_decoration", char: "🎍", name: "门松" },
            { key: "japanese_dolls", char: "🎎", name: "日本人形" },
            { key: "carp_streamer", char: "🎏", name: "鲤鱼旗" },
            { key: "wind_chime", char: "🎐", name: "风铃" },
            { key: "moon_viewing", char: "🎑", name: "赏月" },
            { key: "red_envelope", char: "🧧", name: "红包" },
            { key: "ribbon", char: "🎀", name: "蝴蝶结" },
            { key: "wrapped_gift", char: "🎁", name: "礼物" },
            { key: "reminder_ribbon", char: "🎗", name: "提示丝带" },
            { key: "admission_tickets", char: "🎟", name: "入场券" },
            { key: "ticket", char: "🎫", name: "票" }
          ]
        },
        {
          key: "awards_and_medals",
          name: "奖项和奖牌",
          char: "🏅",
          emojis: [
            { key: "military_medal", char: "🎖", name: "军功章" },
            { key: "trophy", char: "🏆", name: "奖杯" },
            { key: "sports_medal", char: "🏅", name: "奖牌" },
            { key: "gold_medal", char: "🥇", name: "金牌" },
            { key: "silver_medal", char: "🥈", name: "银牌" },
            { key: "bronze_medal", char: "🥉", name: "铜牌" }
          ]
        },
        {
          key: "sports",
          name: "运动",
          char: "🏀",
          emojis: [
            { key: "soccer_ball", char: "⚽", name: "足球" },
            { key: "baseball", char: "⚾", name: "棒球" },
            { key: "softball", char: "🥎", name: "垒球" },
            { key: "basketball", char: "🏀", name: "篮球" },
            { key: "volleyball", char: "🏐", name: "排球" },
            { key: "american_football", char: "🏈", name: "美式橄榄球" },
            { key: "rugby_football", char: "🏉", name: "英式橄榄球" },
            { key: "tennis", char: "🎾", name: "网球" },
            { key: "flying_disc", char: "🥏", name: "飞盘" },
            { key: "bowling", char: "🎳", name: "保龄球" },
            { key: "cricket_game", char: "🏏", name: "板球" },
            { key: "field_hockey", char: "🏑", name: "曲棍球" },
            { key: "ice_hockey", char: "🏒", name: "冰球" },
            { key: "lacrosse", char: "🥍", name: "袋棍球" },
            { key: "ping_pong", char: "🏓", name: "乒乓球" },
            { key: "badminton", char: "🏸", name: "羽毛球" },
            { key: "boxing_glove", char: "🥊", name: "拳击手套" },
            { key: "martial_arts_uniform", char: "🥋", name: "练武服" },
            { key: "goal_net", char: "🥅", name: "球门" },
            { key: "golf", char: "⛳", name: "高尔夫球洞" },
            { key: "ice_skate", char: "⛸", name: "滑冰" },
            { key: "fishing_pole", char: "🎣", name: "钓鱼竿" },
            { key: "diving_mask", char: "🤿", name: "潜水面罩" },
            { key: "running_shirt", char: "🎽", name: "运动背心" },
            { key: "skis", char: "🎿", name: "滑雪" },
            { key: "sled", char: "🛷", name: "雪橇" },
            { key: "curling_stone", char: "🥌", name: "冰壶" }
          ]
        },
        {
          key: "games",
          name: "游戏",
          char: "🎯",
          emojis: [
            { key: "bullseye", char: "🎯", name: "正中靶心的飞镖" },
            { key: "yo_yo", char: "🪀", name: "悠悠球" },
            { key: "kite", char: "🪁", name: "风筝" },
            { key: "pool_8_ball", char: "🎱", name: "台球" },
            { key: "crystal_ball", char: "🔮", name: "水晶球" },
            { key: "magic_wand", char: "🪄", name: "魔棒" },
            { key: "video_game", char: "🎮", name: "游戏手柄" },
            { key: "joystick", char: "🕹", name: "游戏操控杆" },
            { key: "slot_machine", char: "🎰", name: "老虎机" },
            { key: "game_die", char: "🎲", name: "骰子" },
            { key: "puzzle_piece", char: "🧩", name: "拼图" },
            { key: "teddy_bear", char: "🧸", name: "泰迪熊" },
            { key: "pinata", char: "🪅", name: "彩罐" },
            { key: "mirror_ball", char: "🪩", name: "镜球" },
            { key: "nesting_dolls", char: "🪆", name: "套娃" },
            { key: "spade_suit", char: "♠", name: "黑桃" },
            { key: "heart_suit", char: "♥", name: "红桃" },
            { key: "diamond_suit", char: "♦", name: "方片" },
            { key: "club_suit", char: "♣", name: "梅花" },
            { key: "chess_pawn", char: "♟", name: "兵" },
            { key: "joker", char: "🃏", name: "大小王" },
            { key: "mahjong_red_dragon", char: "🀄", name: "红中" },
            { key: "flower_playing_cards", char: "🎴", name: "花札" },
            { key: "water_pistol", char: "🔫", name: "水枪" }
          ]
        },
        {
          key: "arts_and_crafts",
          name: "艺术和工艺",
          char: "🎨",
          emojis: [
            { key: "performing_arts", char: "🎭", name: "表演艺术" },
            { key: "framed_picture", char: "🖼", name: "带框的画" },
            { key: "artist_palette", char: "🎨", name: "调色盘" },
            { key: "thread", char: "🧵", name: "线" },
            { key: "sewing_needle", char: "🪡", name: "缝合针" },
            { key: "yarn", char: "🧶", name: "毛线" },
            { key: "knot", char: "🪢", name: "结" }
          ]
        }
      ]
    },
    {
      key: "objects",
      name: "物品",
      char: "🔋",
      subcategories: [
        {
          key: "clothing",
          name: "服装",
          char: "👖",
          emojis: [
            { key: "glasses", char: "👓", name: "眼镜" },
            { key: "sunglasses", char: "🕶", name: "墨镜" },
            { key: "goggles", char: "🥽", name: "护目镜" },
            { key: "lab_coat", char: "🥼", name: "白大褂" },
            { key: "safety_vest", char: "🦺", name: "救生衣" },
            { key: "necktie", char: "👔", name: "领带" },
            { key: "t_shirt", char: "👕", name: "T恤" },
            { key: "jeans", char: "👖", name: "牛仔裤" },
            { key: "scarf", char: "🧣", name: "围巾" },
            { key: "gloves", char: "🧤", name: "手套" },
            { key: "coat", char: "🧥", name: "外套" },
            { key: "socks", char: "🧦", name: "袜子" },
            { key: "dress", char: "👗", name: "连衣裙" },
            { key: "kimono", char: "👘", name: "和服" },
            { key: "sari", char: "🥻", name: "纱丽" },
            { key: "one_piece_swimsuit", char: "🩱", name: "连体泳衣" },
            { key: "briefs", char: "🩲", name: "三角裤" },
            { key: "shorts", char: "🩳", name: "短裤" },
            { key: "bikini", char: "👙", name: "比基尼" },
            { key: "womans_clothes", char: "👚", name: "女装" },
            { key: "purse", char: "👛", name: "钱包" },
            { key: "handbag", char: "👜", name: "手提包" },
            { key: "clutch_bag", char: "👝", name: "手袋" },
            { key: "shopping_bags", char: "🛍", name: "购物袋" },
            { key: "backpack", char: "🎒", name: "书包" },
            { key: "thong_sandal", char: "🩴", name: "夹趾凉鞋" },
            { key: "mans_shoe", char: "👞", name: "男鞋" },
            { key: "running_shoe", char: "👟", name: "跑鞋" },
            { key: "hiking_boot", char: "🥾", name: "登山鞋" },
            { key: "flat_shoe", char: "🥿", name: "平底鞋" },
            { key: "high_heeled_shoe", char: "👠", name: "高跟鞋" },
            { key: "womans_sandal", char: "👡", name: "女式凉鞋" },
            { key: "ballet_shoes", char: "🩰", name: "芭蕾舞鞋" },
            { key: "womans_boot", char: "👢", name: "女靴" },
            { key: "crown", char: "👑", name: "皇冠" },
            { key: "womans_hat", char: "👒", name: "女帽" },
            { key: "top_hat", char: "🎩", name: "礼帽" },
            { key: "graduation_cap", char: "🎓", name: "毕业帽" },
            { key: "billed_cap", char: "🧢", name: "鸭舌帽" },
            { key: "military_helmet", char: "🪖", name: "军用头盔" },
            { key: "rescue_workers_helmet", char: "⛑", name: "白十字头盔" },
            { key: "prayer_beads", char: "📿", name: "念珠" },
            { key: "lipstick", char: "💄", name: "唇膏" },
            { key: "ring", char: "💍", name: "戒指" },
            { key: "gem_stone", char: "💎", name: "宝石" }
          ]
        },
        {
          key: "sound",
          name: "声音",
          char: "📢",
          emojis: [
            { key: "muted_speaker", char: "🔇", name: "已静音的扬声器" },
            { key: "speaker_low_volume", char: "🔈", name: "低音量的扬声器" },
            { key: "speaker_medium_volume", char: "🔉", name: "中等音量的扬声器" },
            { key: "speaker_high_volume", char: "🔊", name: "高音量的扬声器" },
            { key: "loudspeaker", char: "📢", name: "喇叭" },
            { key: "megaphone", char: "📣", name: "扩音器" },
            { key: "postal_horn", char: "📯", name: "邮号" },
            { key: "bell", char: "🔔", name: "铃铛" },
            { key: "bell_with_slash", char: "🔕", name: "禁止响铃" }
          ]
        },
        {
          key: "music",
          name: "音乐",
          char: "🎵",
          emojis: [
            { key: "musical_score", char: "🎼", name: "乐谱" },
            { key: "musical_note", char: "🎵", name: "音符" },
            { key: "musical_notes", char: "🎶", name: "多个音符" },
            { key: "studio_microphone", char: "🎙", name: "录音室麦克风" },
            { key: "level_slider", char: "🎚", name: "电平滑块" },
            { key: "control_knobs", char: "🎛", name: "控制旋钮" },
            { key: "microphone", char: "🎤", name: "麦克风" },
            { key: "headphone", char: "🎧", name: "耳机" },
            { key: "radio", char: "📻", name: "收音机" }
          ]
        },
        {
          key: "musical_instruments",
          name: "乐器",
          char: "🎹",
          emojis: [
            { key: "saxophone", char: "🎷", name: "萨克斯管" },
            { key: "accordion", char: "🪗", name: "手风琴" },
            { key: "guitar", char: "🎸", name: "吉他" },
            { key: "musical_keyboard", char: "🎹", name: "音乐键盘" },
            { key: "trumpet", char: "🎺", name: "小号" },
            { key: "violin", char: "🎻", name: "小提琴" },
            { key: "banjo", char: "🪕", name: "班卓琴" },
            { key: "drum", char: "🥁", name: "鼓" },
            { key: "long_drum", char: "🪘", name: "长鼓" }
          ]
        },
        {
          key: "phone",
          name: "电话",
          char: "📞",
          emojis: [
            { key: "mobile_phone", char: "📱", name: "手机" },
            { key: "mobile_phone_with_arrow", char: "📲", name: "带有箭头的手机" },
            { key: "telephone", char: "☎", name: "电话" },
            { key: "telephone_receiver", char: "📞", name: "电话听筒" },
            { key: "pager", char: "📟", name: "寻呼机" },
            { key: "fax_machine", char: "📠", name: "传真机" }
          ]
        },
        {
          key: "computer",
          name: "电脑",
          char: "💻️",
          emojis: [
            { key: "battery", char: "🔋", name: "电池" },
            { key: "low_battery", char: "🪫", name: "电池电量不足" },
            { key: "electric_plug", char: "🔌", name: "电源插头" },
            { key: "laptop", char: "💻", name: "笔记本电脑" },
            { key: "desktop_computer", char: "🖥", name: "台式电脑" },
            { key: "printer", char: "🖨", name: "打印机" },
            { key: "keyboard", char: "⌨", name: "键盘" },
            { key: "computer_mouse", char: "🖱", name: "电脑鼠标" },
            { key: "trackball", char: "🖲", name: "轨迹球" },
            { key: "computer_disk", char: "💽", name: "电脑光盘" },
            { key: "floppy_disk", char: "💾", name: "软盘" },
            { key: "optical_disk", char: "💿", name: "光盘" },
            { key: "dvd", char: "📀", name: "DVD" },
            { key: "abacus", char: "🧮", name: "算盘" }
          ]
        },
        {
          key: "light_and_video",
          name: "灯光和视频",
          char: "💡",
          emojis: [
            { key: "movie_camera", char: "🎥", name: "电影摄影机" },
            { key: "film_frames", char: "🎞", name: "影片帧" },
            { key: "film_projector", char: "📽", name: "电影放映机" },
            { key: "clapper_board", char: "🎬", name: "场记板" },
            { key: "television", char: "📺", name: "电视机" },
            { key: "camera", char: "📷", name: "相机" },
            { key: "camera_with_flash", char: "📸", name: "开闪光灯的相机" },
            { key: "video_camera", char: "📹", name: "摄像机" },
            { key: "videocassette", char: "📼", name: "录像带" },
            { key: "magnifying_glass_tilted_left", char: "🔍", name: "左斜的放大镜" },
            { key: "magnifying_glass_tilted_right", char: "🔎", name: "右斜的放大镜" },
            { key: "candle", char: "🕯", name: "蜡烛" },
            { key: "light_bulb", char: "💡", name: "灯泡" },
            { key: "flashlight", char: "🔦", name: "手电筒" },
            { key: "red_paper_lantern", char: "🏮", name: "红灯笼" },
            { key: "diya_lamp", char: "🪔", name: "印度油灯" }
          ]
        },
        {
          key: "books_and_paper",
          name: "书籍和纸张",
          char: "📒",
          emojis: [
            { key: "notebook_with_decorative_cover", char: "📔", name: "精装笔记本" },
            { key: "closed_book", char: "📕", name: "合上的书本" },
            { key: "open_book", char: "📖", name: "打开的书本" },
            { key: "green_book", char: "📗", name: "绿色书本" },
            { key: "blue_book", char: "📘", name: "蓝色书本" },
            { key: "orange_book", char: "📙", name: "橙色书本" },
            { key: "books", char: "📚", name: "书" },
            { key: "notebook", char: "📓", name: "笔记本" },
            { key: "ledger", char: "📒", name: "账本" },
            { key: "page_with_curl", char: "📃", name: "带卷边的页面" },
            { key: "scroll", char: "📜", name: "卷轴" },
            { key: "page_facing_up", char: "📄", name: "文件" },
            { key: "newspaper", char: "📰", name: "报纸" },
            { key: "rolled_up_newspaper", char: "🗞", name: "报纸卷" },
            { key: "bookmark_tabs", char: "📑", name: "标签页" },
            { key: "bookmark", char: "🔖", name: "书签" },
            { key: "label", char: "🏷", name: "标签" }
          ]
        },
        {
          key: "money",
          name: "金钱",
          char: "💰",
          emojis: [
            { key: "money_bag", char: "💰", name: "钱袋" },
            { key: "coin", char: "🪙", name: "硬币" },
            { key: "yen_banknote", char: "💴", name: "日元" },
            { key: "dollar_banknote", char: "💵", name: "美元" },
            { key: "euro_banknote", char: "💶", name: "欧元" },
            { key: "pound_banknote", char: "💷", name: "英镑" },
            { key: "money_with_wings", char: "💸", name: "长翅膀的钱" },
            { key: "credit_card", char: "💳", name: "信用卡" },
            { key: "receipt", char: "🧾", name: "收据" },
            { key: "chart_increasing_with_yen", char: "💹", name: "趋势向上且带有日元符号的图表" }
          ]
        },
        {
          key: "mail",
          name: "邮件",
          char: "✉️",
          emojis: [
            { key: "envelope", char: "✉", name: "信封" },
            { key: "e_mail", char: "📧", name: "电子邮件" },
            { key: "incoming_envelope", char: "📨", name: "来信" },
            { key: "envelope_with_arrow", char: "📩", name: "收邮件" },
            { key: "outbox_tray", char: "📤", name: "发件箱" },
            { key: "inbox_tray", char: "📥", name: "收件箱" },
            { key: "package", char: "📦", name: "包裹" },
            { key: "closed_mailbox_with_raised_flag", char: "📫", name: "有待收信件" },
            { key: "closed_mailbox_with_lowered_flag", char: "📪", name: "无待收信件" },
            { key: "open_mailbox_with_raised_flag", char: "📬", name: "有新信件" },
            { key: "open_mailbox_with_lowered_flag", char: "📭", name: "无新信件" },
            { key: "postbox", char: "📮", name: "邮筒" },
            { key: "ballot_box_with_ballot", char: "🗳", name: "投票箱" }
          ]
        },
        {
          key: "writing",
          name: "书写",
          char: "✏️",
          emojis: [
            { key: "pencil", char: "✏", name: "铅笔" },
            { key: "black_nib", char: "✒", name: "钢笔尖" },
            { key: "fountain_pen", char: "🖋", name: "钢笔" },
            { key: "pen", char: "🖊", name: "笔" },
            { key: "paintbrush", char: "🖌", name: "画笔" },
            { key: "crayon", char: "🖍", name: "蜡笔" },
            { key: "memo", char: "📝", name: "备忘录" }
          ]
        },
        {
          key: "office",
          name: "办公",
          char: "✂️",
          emojis: [
            { key: "briefcase", char: "💼", name: "公文包" },
            { key: "file_folder", char: "📁", name: "文件夹" },
            { key: "open_file_folder", char: "📂", name: "打开的文件夹" },
            { key: "card_index_dividers", char: "🗂", name: "索引分隔文件夹" },
            { key: "calendar", char: "📅", name: "日历" },
            { key: "tear_off_calendar", char: "📆", name: "手撕日历" },
            { key: "spiral_notepad", char: "🗒", name: "线圈本" },
            { key: "spiral_calendar", char: "🗓", name: "线圈日历" },
            { key: "card_index", char: "📇", name: "卡片索引" },
            { key: "chart_increasing", char: "📈", name: "趋势向上的图表" },
            { key: "chart_decreasing", char: "📉", name: "趋势向下的图表" },
            { key: "bar_chart", char: "📊", name: "条形图" },
            { key: "clipboard", char: "📋", name: "剪贴板" },
            { key: "pushpin", char: "📌", name: "图钉" },
            { key: "round_pushpin", char: "📍", name: "圆图钉" },
            { key: "paperclip", char: "📎", name: "回形针" },
            { key: "linked_paperclips", char: "🖇", name: "连起来的两个回形针" },
            { key: "straight_ruler", char: "📏", name: "直尺" },
            { key: "triangular_ruler", char: "📐", name: "三角尺" },
            { key: "scissors", char: "✂", name: "剪刀" },
            { key: "card_file_box", char: "🗃", name: "卡片盒" },
            { key: "file_cabinet", char: "🗄", name: "文件柜" },
            { key: "wastebasket", char: "🗑", name: "垃圾桶" }
          ]
        },
        {
          key: "lock_and_key",
          name: "锁和钥匙",
          char: "🔏",
          emojis: [
            { key: "locked", char: "🔒", name: "合上的锁" },
            { key: "unlocked", char: "🔓", name: "打开的锁" },
            { key: "locked_with_pen", char: "🔏", name: "墨水笔和锁" },
            { key: "locked_with_key", char: "🔐", name: "钥匙和锁" },
            { key: "key", char: "🔑", name: "钥匙" },
            { key: "old_key", char: "🗝", name: "老式钥匙" }
          ]
        },
        {
          key: "tools",
          name: "工具",
          char: "⛏️",
          emojis: [
            { key: "bomb", char: "💣", name: "炸弹" },
            { key: "hammer", char: "🔨", name: "锤子" },
            { key: "axe", char: "🪓", name: "斧头" },
            { key: "pick", char: "⛏", name: "铁镐" },
            { key: "hammer_and_pick", char: "⚒", name: "锤子与镐" },
            { key: "hammer_and_wrench", char: "🛠", name: "锤子与扳手" },
            { key: "dagger", char: "🗡", name: "匕首" },
            { key: "crossed_swords", char: "⚔", name: "交叉放置的剑" },
            { key: "boomerang", char: "🪃", name: "回旋镖" },
            { key: "bow_and_arrow", char: "🏹", name: "弓和箭" },
            { key: "shield", char: "🛡", name: "盾牌" },
            { key: "carpentry_saw", char: "🪚", name: "木工锯" },
            { key: "wrench", char: "🔧", name: "扳手" },
            { key: "screwdriver", char: "🪛", name: "螺丝刀" },
            { key: "nut_and_bolt", char: "🔩", name: "螺母与螺栓" },
            { key: "gear", char: "⚙", name: "齿轮" },
            { key: "clamp", char: "🗜", name: "夹钳" },
            { key: "balance_scale", char: "⚖", name: "天平" },
            { key: "white_cane", char: "🦯", name: "盲杖" },
            { key: "link", char: "🔗", name: "链接" },
            { key: "chains", char: "⛓", name: "链条" },
            { key: "hook", char: "🪝", name: "挂钩" },
            { key: "toolbox", char: "🧰", name: "工具箱" },
            { key: "magnet", char: "🧲", name: "磁铁" },
            { key: "ladder", char: "🪜", name: "梯子" }
          ]
        },
        {
          key: "science",
          name: "科技",
          char: "🔭",
          emojis: [
            { key: "alembic", char: "⚗", name: "蒸馏器" },
            { key: "test_tube", char: "🧪", name: "试管" },
            { key: "petri_dish", char: "🧫", name: "培养皿" },
            { key: "dna", char: "🧬", name: "DNA" },
            { key: "microscope", char: "🔬", name: "显微镜" },
            { key: "telescope", char: "🔭", name: "望远镜" },
            { key: "satellite_antenna", char: "📡", name: "卫星天线" }
          ]
        },
        {
          key: "medical",
          name: "医疗",
          char: "💊",
          emojis: [
            { key: "syringe", char: "💉", name: "注射器" },
            { key: "drop_of_blood", char: "🩸", name: "血滴" },
            { key: "pill", char: "💊", name: "药丸" },
            { key: "adhesive_bandage", char: "🩹", name: "创可贴" },
            { key: "crutch", char: "🩼", name: "拐杖" },
            { key: "stethoscope", char: "🩺", name: "听诊器" },
            { key: "x_ray", char: "🩻", name: "X射线" }
          ]
        },
        {
          key: "household",
          name: "家居",
          char: "🚽",
          emojis: [
            { key: "door", char: "🚪", name: "门" },
            { key: "elevator", char: "🛗", name: "电梯" },
            { key: "mirror", char: "🪞", name: "镜子" },
            { key: "window", char: "🪟", name: "窗户" },
            { key: "bed", char: "🛏", name: "床" },
            { key: "couch_and_lamp", char: "🛋", name: "沙发和灯" },
            { key: "chair", char: "🪑", name: "椅子" },
            { key: "toilet", char: "🚽", name: "马桶" },
            { key: "plunger", char: "🪠", name: "活塞" },
            { key: "shower", char: "🚿", name: "淋浴" },
            { key: "bathtub", char: "🛁", name: "浴缸" },
            { key: "mouse_trap", char: "🪤", name: "捕鼠器" },
            { key: "razor", char: "🪒", name: "剃须刀" },
            { key: "lotion_bottle", char: "🧴", name: "乳液瓶" },
            { key: "safety_pin", char: "🧷", name: "安全别针" },
            { key: "broom", char: "🧹", name: "扫帚" },
            { key: "basket", char: "🧺", name: "筐" },
            { key: "roll_of_paper", char: "🧻", name: "卷纸" },
            { key: "bucket", char: "🪣", name: "桶" },
            { key: "soap", char: "🧼", name: "皂" },
            { key: "bubbles", char: "🫧", name: "气泡" },
            { key: "toothbrush", char: "🪥", name: "牙刷" },
            { key: "sponge", char: "🧽", name: "海绵" },
            { key: "fire_extinguisher", char: "🧯", name: "灭火器" },
            { key: "shopping_cart", char: "🛒", name: "购物车" }
          ]
        },
        {
          key: "other_objects",
          name: "其他物品",
          char: "🚬",
          emojis: [
            { key: "nazar_amulet", char: "🧿", name: "纳扎尔护身符" },
            { key: "hamsa", char: "🪬", name: "法蒂玛之手" },
            { key: "cigarette", char: "🚬", name: "香烟" },
            { key: "coffin", char: "⚰", name: "棺材" },
            { key: "headstone", char: "🪦", name: "墓碑" },
            { key: "funeral_urn", char: "⚱", name: "骨灰缸" },
            { key: "moai", char: "🗿", name: "摩埃" },
            { key: "placard", char: "🪧", name: "标语牌" },
            { key: "identification_card", char: "🪪", name: "身份证" }
          ]
        }
      ]
    },
    {
      key: "symbols",
      name: "符号",
      char: "🛑",
      subcategories: [
        {
          key: "public_signs",
          name: "公共标志",
          char: "🚻",
          emojis: [
            { key: "atm_sign", char: "🏧", name: "取款机" },
            { key: "litter_in_bin_sign", char: "🚮", name: "倒垃圾" },
            { key: "potable_water", char: "🚰", name: "饮用水" },
            { key: "wheelchair_symbol", char: "♿", name: "轮椅标识" },
            { key: "mens_room", char: "🚹", name: "男厕" },
            { key: "womens_room", char: "🚺", name: "女厕" },
            { key: "restroom", char: "🚻", name: "卫生间" },
            { key: "baby_symbol", char: "🚼", name: "宝宝" },
            { key: "water_closet", char: "🚾", name: "厕所" },
            { key: "passport_control", char: "🛂", name: "护照检查" },
            { key: "customs", char: "🛃", name: "海关" },
            { key: "baggage_claim", char: "🛄", name: "提取行李" },
            { key: "left_luggage", char: "🛅", name: "寄存行李" }
          ]
        },
        {
          key: "warnings",
          name: "警示",
          char: "⚠️",
          emojis: [
            { key: "warning", char: "⚠", name: "警告" },
            { key: "children_crossing", char: "🚸", name: "儿童过街" },
            { key: "no_entry", char: "⛔", name: "禁止通行" },
            { key: "prohibited", char: "🚫", name: "禁止" },
            { key: "no_bicycles", char: "🚳", name: "禁止自行车" },
            { key: "no_smoking", char: "🚭", name: "禁止吸烟" },
            { key: "no_littering", char: "🚯", name: "禁止乱扔垃圾" },
            { key: "non_potable_water", char: "🚱", name: "非饮用水" },
            { key: "no_pedestrians", char: "🚷", name: "禁止行人通行" },
            { key: "no_mobile_phones", char: "📵", name: "禁止使用手机" },
            { key: "no_one_under_eighteen", char: "🔞", name: "18禁" },
            { key: "radioactive", char: "☢", name: "辐射" },
            { key: "biohazard", char: "☣", name: "生物危害" }
          ]
        },
        {
          key: "arrows",
          name: "箭头",
          char: "↩️",
          emojis: [
            { key: "up_arrow", char: "⬆", name: "向上箭头" },
            { key: "up_right_arrow", char: "↗", name: "右上箭头" },
            { key: "right_arrow", char: "➡", name: "向右箭头" },
            { key: "down_right_arrow", char: "↘", name: "右下箭头" },
            { key: "down_arrow", char: "⬇", name: "向下箭头" },
            { key: "down_left_arrow", char: "↙", name: "左下箭头" },
            { key: "left_arrow", char: "⬅", name: "向左箭头" },
            { key: "up_left_arrow", char: "↖", name: "左上箭头" },
            { key: "up_down_arrow", char: "↕", name: "上下箭头" },
            { key: "left_right_arrow", char: "↔", name: "左右箭头" },
            { key: "right_arrow_curving_left", char: "↩", name: "右转弯箭头" },
            { key: "left_arrow_curving_right", char: "↪", name: "左转弯箭头" },
            { key: "right_arrow_curving_up", char: "⤴", name: "右上弯箭头" },
            { key: "right_arrow_curving_down", char: "⤵", name: "右下弯箭头" },
            { key: "clockwise_vertical_arrows", char: "🔃", name: "顺时针垂直箭头" },
            { key: "counterclockwise_arrows_button", char: "🔄", name: "逆时针箭头按钮" },
            { key: "back_arrow", char: "🔙", name: "返回箭头" },
            { key: "end_arrow", char: "🔚", name: "结束箭头" },
            { key: "on_arrow", char: "🔛", name: "ON! 箭头" },
            { key: "soon_arrow", char: "🔜", name: "SOON 箭头" },
            { key: "top_arrow", char: "🔝", name: "置顶" }
          ]
        },
        {
          key: "religion",
          name: "宗教",
          char: "☪️",
          emojis: [
            { key: "place_of_worship", char: "🛐", name: "宗教场所" },
            { key: "atom_symbol", char: "⚛", name: "原子符号" },
            { key: "om", char: "🕉", name: "奥姆" },
            { key: "star_of_david", char: "✡", name: "六芒星" },
            { key: "wheel_of_dharma", char: "☸", name: "法轮" },
            { key: "yin_yang", char: "☯", name: "阴阳" },
            { key: "latin_cross", char: "✝", name: "十字架" },
            { key: "orthodox_cross", char: "☦", name: "东正教十字架" },
            { key: "star_and_crescent", char: "☪", name: "星月" },
            { key: "peace_symbol", char: "☮", name: "和平符号" },
            { key: "menorah", char: "🕎", name: "烛台" },
            { key: "dotted_six_pointed_star", char: "🔯", name: "带中间点的六芒星" }
          ]
        },
        {
          key: "zodiac",
          name: "星座",
          char: "♈️",
          emojis: [
            { key: "aries", char: "♈", name: "白羊座" },
            { key: "taurus", char: "♉", name: "金牛座" },
            { key: "gemini", char: "♊", name: "双子座" },
            { key: "cancer", char: "♋", name: "巨蟹座" },
            { key: "leo", char: "♌", name: "狮子座" },
            { key: "virgo", char: "♍", name: "处女座" },
            { key: "libra", char: "♎", name: "天秤座" },
            { key: "scorpius", char: "♏", name: "天蝎座" },
            { key: "sagittarius", char: "♐", name: "射手座" },
            { key: "capricorn", char: "♑", name: "摩羯座" },
            { key: "aquarius", char: "♒", name: "水瓶座" },
            { key: "pisces", char: "♓", name: "双鱼座" },
            { key: "ophiuchus", char: "⛎", name: "蛇夫座" }
          ]
        },
        {
          key: "av_symbols",
          name: "音频和视频符号",
          char: "⏏️",
          emojis: [
            { key: "shuffle_tracks_button", char: "🔀", name: "随机播放音轨按钮" },
            { key: "repeat_button", char: "🔁", name: "重复按钮" },
            { key: "repeat_single_button", char: "🔂", name: "重复一次按钮" },
            { key: "play_button", char: "▶", name: "播放按钮" },
            { key: "fast_forward_button", char: "⏩", name: "快进按钮" },
            { key: "next_track_button", char: "⏭", name: "下一个音轨按钮" },
            { key: "play_or_pause_button", char: "⏯", name: "播放或暂停按钮" },
            { key: "reverse_button", char: "◀", name: "倒退按钮" },
            { key: "fast_reverse_button", char: "⏪", name: "快退按钮" },
            { key: "last_track_button", char: "⏮", name: "上一个音轨按钮" },
            { key: "upwards_button", char: "🔼", name: "向上三角形按钮" },
            { key: "fast_up_button", char: "⏫", name: "快速上升按钮" },
            { key: "downwards_button", char: "🔽", name: "向下三角形按钮" },
            { key: "fast_down_button", char: "⏬", name: "快速下降按钮" },
            { key: "pause_button", char: "⏸", name: "暂停按钮" },
            { key: "stop_button", char: "⏹", name: "停止按钮" },
            { key: "record_button", char: "⏺", name: "录制按钮" },
            { key: "eject_button", char: "⏏", name: "推出按钮" },
            { key: "cinema", char: "🎦", name: "电影院" },
            { key: "dim_button", char: "🔅", name: "低亮度按钮" },
            { key: "bright_button", char: "🔆", name: "高亮度按钮" },
            { key: "antenna_bars", char: "📶", name: "信号强度条" },
            { key: "vibration_mode", char: "📳", name: "振动模式" },
            { key: "mobile_phone_off", char: "📴", name: "手机关机" }
          ]
        },
        {
          key: "gender",
          name: "性别",
          char: "♀️",
          emojis: [
            { key: "female_sign", char: "♀", name: "女性符号" },
            { key: "male_sign", char: "♂", name: "男性符号" },
            { key: "transgender_symbol", char: "⚧", name: "跨性别符号" }
          ]
        },
        {
          key: "math",
          name: "数学",
          char: "✖️",
          emojis: [
            { key: "multiply", char: "✖", name: "乘" },
            { key: "plus", char: "➕", name: "加" },
            { key: "minus", char: "➖", name: "减" },
            { key: "divide", char: "➗", name: "除" },
            { key: "heavy_equals_sign", char: "🟰", name: "粗等号" },
            { key: "infinity", char: "♾", name: "无穷大" }
          ]
        },
        {
          key: "punctuation",
          name: "标点",
          char: "‼️",
          emojis: [
            { key: "double_exclamation_mark", char: "‼", name: "双感叹号" },
            { key: "exclamation_question_mark", char: "⁉", name: "感叹疑问号" },
            { key: "red_question_mark", char: "❓", name: "红色问号" },
            { key: "white_question_mark", char: "❔", name: "白色问号" },
            { key: "white_exclamation_mark", char: "❕", name: "白色感叹号" },
            { key: "red_exclamation_mark", char: "❗", name: "红色感叹号" },
            { key: "wavy_dash", char: "〰", name: "波浪型破折号" }
          ]
        },
        {
          key: "currency",
          name: "货币",
          char: "💲",
          emojis: [
            { key: "currency_exchange", char: "💱", name: "货币兑换" },
            { key: "heavy_dollar_sign", char: "💲", name: "粗美元符号" }
          ]
        },
        {
          key: "other_symbols",
          name: "其他符号",
          char: "☑️",
          emojis: [
            { key: "medical_symbol", char: "⚕", name: "医疗标志" },
            { key: "recycling_symbol", char: "♻", name: "回收标志" },
            { key: "fleur_de_lis", char: "⚜", name: "百合花饰" },
            { key: "trident_emblem", char: "🔱", name: "三叉戟徽章" },
            { key: "name_badge", char: "📛", name: "姓名牌" },
            { key: "japanese_symbol_for_beginner", char: "🔰", name: "日本新手驾驶标志" },
            { key: "hollow_red_circle", char: "⭕", name: "红色空心圆圈" },
            { key: "check_mark_button", char: "✅", name: "勾号按钮" },
            { key: "check_box_with_check", char: "☑", name: "勾选框" },
            { key: "check_mark", char: "✔", name: "勾号" },
            { key: "cross_mark", char: "❌", name: "叉号" },
            { key: "cross_mark_button", char: "❎", name: "叉号按钮" },
            { key: "curly_loop", char: "➰", name: "卷曲环" },
            { key: "double_curly_loop", char: "➿", name: "双卷曲环" },
            { key: "part_alternation_mark", char: "〽", name: "庵点" },
            { key: "eight_spoked_asterisk", char: "✳", name: "八轮辐星号" },
            { key: "eight_pointed_star", char: "✴", name: "八角星" },
            { key: "sparkle", char: "❇", name: "火花" },
            { key: "copyright", char: "©", name: "版权" },
            { key: "registered", char: "®", name: "注册" },
            { key: "trade_mark", char: "™", name: "商标" }
          ]
        },
        {
          key: "keycaps",
          name: "键帽",
          char: "0️⃣",
          emojis: [
            { key: "keycap_hash", char: "#️⃣", name: "按键: #" },
            { key: "keycap_star", char: "*️⃣", name: "键帽：*" },
            { key: "keycap_0", char: "0️⃣", name: "键帽：0" },
            { key: "keycap_1", char: "1️⃣", name: "键帽：1" },
            { key: "keycap_2", char: "2️⃣", name: "键帽：2" },
            { key: "keycap_3", char: "3️⃣", name: "键帽：3" },
            { key: "keycap_4", char: "4️⃣", name: "键帽：4" },
            { key: "keycap_5", char: "5️⃣", name: "键帽：5" },
            { key: "keycap_6", char: "6️⃣", name: "键帽：6" },
            { key: "keycap_7", char: "7️⃣", name: "键帽：7" },
            { key: "keycap_8", char: "8️⃣", name: "键帽：8" },
            { key: "keycap_9", char: "9️⃣", name: "键帽：9" },
            { key: "keycap_10", char: "🔟", name: "按键: 10" }
          ]
        },
        {
          key: "alphanum",
          name: "字符",
          char: "🅰️",
          emojis: [
            { key: "input_latin_uppercase", char: "🔠", name: "输入大写拉丁字母" },
            { key: "input_latin_lowercase", char: "🔡", name: "输入小写拉丁字母" },
            { key: "input_numbers", char: "🔢", name: "输入数字" },
            { key: "input_symbols", char: "🔣", name: "输入符号" },
            { key: "input_latin_letters", char: "🔤", name: "输入拉丁字母" },
            { key: "a_blood_type", char: "🅰", name: "A型血" },
            { key: "ab_blood_type", char: "🆎", name: "AB型血" },
            { key: "b_blood_type", char: "🅱", name: "B型血" },
            { key: "cl_button", char: "🆑", name: "CL按钮" },
            { key: "cool_button", char: "🆒", name: "cool按钮" },
            { key: "free_button", char: "🆓", name: "免费按钮" },
            { key: "information", char: "ℹ", name: "信息" },
            { key: "id_button", char: "🆔", name: "ID按钮" },
            { key: "circled_m", char: "Ⓜ", name: "圆圈包围的M" },
            { key: "new_button", char: "🆕", name: "new按钮" },
            { key: "ng_button", char: "🆖", name: "NG按钮" },
            { key: "o_blood_type", char: "🅾", name: "O 型血" },
            { key: "ok_button", char: "🆗", name: "OK按钮" },
            { key: "p_button", char: "🅿", name: "停车按钮" },
            { key: "sos_button", char: "🆘", name: "SOS按钮" },
            { key: "up_button", char: "🆙", name: "up按钮" },
            { key: "vs_button", char: "🆚", name: "VS按钮" },
            { key: "japanese_here_button", char: "🈁", name: "日文的「这里」按钮" },
            { key: "japanese_service_charge_button", char: "🈂", name: "日文的「服务费」按钮" },
            { key: "japanese_monthly_amount_button", char: "🈷", name: "日文的「月总量」按钮" },
            { key: "japanese_not_free_of_charge_button", char: "🈶", name: "日文的「收费」按钮" },
            { key: "japanese_reserved_button", char: "🈯", name: "日文的「预留」按钮" },
            { key: "japanese_bargain_button", char: "🉐", name: "日文的「议价」按钮" },
            { key: "japanese_discount_button", char: "🈹", name: "日文的「打折」按钮" },
            { key: "japanese_free_of_charge_button", char: "🈚", name: "日文的「免费」按钮" },
            { key: "japanese_prohibited_button", char: "🈲", name: "日文的「禁止」按钮" },
            { key: "japanese_acceptable_button", char: "🉑", name: "日文的「可接受」按钮" },
            { key: "japanese_application_button", char: "🈸", name: "日文的「申请」按钮" },
            { key: "japanese_passing_grade_button", char: "🈴", name: "日文的「合格」按钮" },
            { key: "japanese_vacancy_button", char: "🈳", name: "日文的「有空位」按钮" },
            { key: "japanese_congratulations_button", char: "㊗", name: "日文的「祝贺」按钮" },
            { key: "japanese_secret_button", char: "㊙", name: "日文的「秘密」按钮" },
            { key: "japanese_open_for_business_button", char: "🈺", name: "日文的「开始营业」按钮" },
            { key: "japanese_no_vacancy_button", char: "🈵", name: "日文的「没有空位」按钮" }
          ]
        },
        {
          key: "geometric",
          name: "几何",
          char: "🟣",
          emojis: [
            { key: "red_circle", char: "🔴", name: "红色圆" },
            { key: "orange_circle", char: "🟠", name: "橙色圆" },
            { key: "yellow_circle", char: "🟡", name: "黄色圆" },
            { key: "green_circle", char: "🟢", name: "绿色圆" },
            { key: "blue_circle", char: "🔵", name: "蓝色圆" },
            { key: "purple_circle", char: "🟣", name: "紫色圆" },
            { key: "brown_circle", char: "🟤", name: "棕色圆" },
            { key: "black_circle", char: "⚫", name: "黑色圆" },
            { key: "white_circle", char: "⚪", name: "白色圆" },
            { key: "red_square", char: "🟥", name: "红色方块" },
            { key: "orange_square", char: "🟧", name: "橙色方块" },
            { key: "yellow_square", char: "🟨", name: "黄色方块" },
            { key: "green_square", char: "🟩", name: "绿色方块" },
            { key: "blue_square", char: "🟦", name: "蓝色方块" },
            { key: "purple_square", char: "🟪", name: "紫色方块" },
            { key: "brown_square", char: "🟫", name: "棕色方块" },
            { key: "black_large_square", char: "⬛", name: "黑线大方框" },
            { key: "white_large_square", char: "⬜", name: "白线大方框" },
            { key: "black_medium_square", char: "◼", name: "黑色中方块" },
            { key: "white_medium_square", char: "◻", name: "白色中方块" },
            { key: "black_medium_small_square", char: "◾", name: "黑色中小方块" },
            { key: "white_medium_small_square", char: "◽", name: "白色中小方块" },
            { key: "black_small_square", char: "▪", name: "黑色小方块" },
            { key: "white_small_square", char: "▫", name: "白色小方块" },
            { key: "large_orange_diamond", char: "🔶", name: "橙色大菱形" },
            { key: "large_blue_diamond", char: "🔷", name: "蓝色大菱形" },
            { key: "small_orange_diamond", char: "🔸", name: "橙色小菱形" },
            { key: "small_blue_diamond", char: "🔹", name: "蓝色小菱形" },
            { key: "red_triangle_pointed_up", char: "🔺", name: "红色正三角" },
            { key: "red_triangle_pointed_down", char: "🔻", name: "红色倒三角" },
            { key: "diamond_with_a_dot", char: "💠", name: "带圆点的菱形" },
            { key: "radio_button", char: "🔘", name: "单选按钮" },
            { key: "white_square_button", char: "🔳", name: "白色方形按钮" },
            { key: "black_square_button", char: "🔲", name: "黑色方形按钮" }
          ]
        }
      ]
    },
    {
      key: "flags",
      name: "旗帜",
      char: "🏁",
      subcategories: [
        {
          key: "common_flags",
          name: "普通旗帜",
          char: "🚩",
          emojis: [
            { key: "checkered_flag", char: "🏁", name: "黑白方格旗" },
            { key: "triangular_flag", char: "🚩", name: "三角旗" },
            { key: "crossed_flags", char: "🎌", name: "交叉旗" },
            { key: "black_flag", char: "🏴", name: "黑旗" },
            { key: "white_flag", char: "🏳", name: "白旗" },
            { key: "rainbow_flag", char: "🏳️‍🌈", name: "彩虹旗" },
            { key: "transgender_flag", char: "🏳️‍⚧️", name: "跨性别旗" },
            { key: "pirate_flag", char: "🏴‍☠️", name: "海盗旗" }
          ]
        }
      ]
    }
  ];

  /**
   * Build a flat search index from the category tree.
   * Each entry: { key, char, name, categoryName, subcategoryName }
   */
  function buildFlatIndex(categories) {
    var flat = [];
    categories.forEach(function(cat) {
      (cat.subcategories || []).forEach(function(sub) {
        (sub.emojis || []).forEach(function(emoji) {
          if (!emoji.isCategory) {
            flat.push({
              key: emoji.key,
              char: emoji.char,
              name: emoji.name,
              categoryName: cat.name,
              subcategoryName: sub.name,
              categoryKey: cat.key,
              subcategoryKey: sub.key
            });
          }
        });
      });
    });
    return flat;
  }

  var EMOJI_FLAT_INDEX = buildFlatIndex(EMOJI_CATEGORIES);

  /**
   * Search emojis by name or key.
   * Returns filtered array, maintaining original order.
   */
  function searchEmojis(query) {
    if (!query || query.trim().length === 0) return EMOJI_FLAT_INDEX;
    var q = query.trim().toLowerCase();
    return EMOJI_FLAT_INDEX.filter(function(e) {
      return e.name.indexOf(q) >= 0 || e.key.toLowerCase().indexOf(q) >= 0;
    });
  }

  /** Get frequently used emojis as a default quick-access set */
  var EMOJI_FREQUENT_KEYS = [
    "face_with_tears_of_joy", "red_heart", "grinning_squinting_face",
    "beaming_face", "thumbs_up", "clapping_hands", "folded_hands",
    "crying_face", "smiling_face_with_hearts", "fire", "ok_hand",
    "pleading_face", "loudly_crying_face", "star_struck_face",
    "rolling_on_the_floor_laughing", "hugging_face", "angry_face",
    "face_screaming_in_fear", "thinking_face", "smiling_face_with_sunglasses",
    "hundred_points", "party_popper", "winking_face", "smirking_face",
    "face_with_rolling_eyes", "sleeping_face", "skull", "speech_balloon",
    "cherry_blossom", "sparkles"
  ];

  function getFrequentEmojis() {
    var map = {};
    EMOJI_FLAT_INDEX.forEach(function(e) { map[e.key] = e; });
    return EMOJI_FREQUENT_KEYS.map(function(k) { return map[k]; }).filter(Boolean);
  }

  global.ChatEmojiData = {
    categories: EMOJI_CATEGORIES,
    flatIndex: EMOJI_FLAT_INDEX,
    searchEmojis: searchEmojis,
    getFrequentEmojis: getFrequentEmojis,
    frequentKeys: EMOJI_FREQUENT_KEYS
  };
})(window);
