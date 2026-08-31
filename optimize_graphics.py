"""Детерминированная упаковка растров PolyGrind в автономный HTML.

Приоритеты: минимальный размер текстур/HTML и видеопамяти без потери читаемости.
Пол намеренно не затрагивается. Основные игровые листы сохраняются индексированными
PNG максимум с 16 палитровыми индексами, включая прозрачный индекс; документированные
исключения для детальных моделей, рамок и трупов имеют собственные бюджеты.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import re
import zipfile
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parent
HTML = ROOT / "PolyGrind.html"
TRANSPARENT_INDEX = 15
PALETTE_COLORS = 15
FRAME_PALETTE_COLORS = 128

RARE_ITEM_SOURCES = {
    "mirror": ("image1.png", "849ba0d0edbcf042cb35a650343dcb628de433182eb57b13c1dc8abbd3346e62"),
    "golem": ("image2.png", "e1aafcf071228ede80755bf9afd5bca55e0573e7c1b53cf1731120ae98d9443a"),
    "fang": ("image3.png", "96bd015df8c65ac7b3642714405c365c811ed77ef58f640080f9d7d1c8e43967"),
    "storm": ("image4.png", "937a53751a09cdc055f78443a849b2096d10904124d43bd4cbba0a20aff84e7e"),
    "ash": ("image5.png", "450765cec0b970e1b7adbe0d904432b1bad922afd41bbd0951be2936155b3ac2"),
    "ice": ("image6.png", "19ca683a89f0f15687113d34a6fc272f4913640afb4aea9070863a0bf4c91d89"),
    "plague": ("image7.png", "5a2c3d5008d58d954665ff085786ada23559a50b6e3918f6196b4a3f0f039859"),
    "clock": ("image8.png", "5522dc68ca9ec3aee3ab2b053a886b410c5cdfe6b1c93faf2a45c20a71c3cf17"),
    "shard": ("image9.png", "534f1a1e65e883cbe7747baef428f5d81ee8a41653371f8d09f1e59363ed4c66"),
    "candle": ("image10.png", "00169d01cb83391ba95e667f31caca9c622a9297daed5f3c9eb485f0f3ad72bf"),
    "doll": ("image11.png", "acfffdfc6b8e585d60c3519b869cc3a0e9bab2ebd9e83049b3c2563048d2d1ac"),
    "chalice": ("image12.png", "710d581e77d5d1d7fd942a442bb88c076d4a9a9002600262e4283e42dabe2fc0"),
    "crown": ("image13.png", "17b57f501574be67c1a28186174d7cd980882da2af932e10e9a8c240960ee575"),
    "bmask": ("image14.png", "279b8689aaceb9db26193f5283b081e36ee9d1bd5d018b0631a95538f9b1eecc"),
    "bossShard": ("image15.png", "4dab8a813721466a3694408d2d0b842517f062b5ef553026d49e0943412dd4da"),
    "bone": ("image16.png", "648d5f3ac51dfe55200b16495710e9103c08b8d8fd5da1ff2e1c4783aa3c041d"),
}

AMULET_ICON_SOURCES = {
    "calm": ("image1.png", "d5f823e555a771a138f4b33355c0bdf1eebc4d9e2536357ab2e8422463e4472f"),
    "runner": ("image3.png", "ce5f0497bfe67173d07807cdefd1c9f259bf2d9cf34c4f53711961311c8e5e94"),
    "pulse": ("image5.png", "c73838880520f6c4e943c026326b358d87a89fc3c0dac1a634dcd83defe7ec8c"),
    "predator": ("image7.png", "7077c25cc802ad5024a4e2f1ffde4c91e41c8b7a8384f43e8070c61431ed4878"),
    "fullplate": ("image9.png", "ab89a964422ab14b65adcde03dc6083f44bc9f44a5da343a1ebb55b9ac98b458"),
    "lastplate": ("image11.png", "c0a23ce05776fc1c4acb917a18cd033b188d43a804f68010c4ce16cdd53b35f8"),
    "steel": ("image13.png", "6d384f7c7c475f72ae6e518bb4cfa05018368093d0630548de6469af3a1d7a3f"),
    "swift": ("image15.png", "047b1eb5dcc4083c6d6ede5ae8c617402a72921dc07380f2d52184ea8e06cf4a"),
    "survive": ("image17.png", "8281bcbdfaaa687e1836a206c06956a54b3c6dda01ca5df991e82dd1ab409eac"),
}

GLOVE_ICON_SOURCES = {
    "claws": ("image1.png", "c29414680621cce6a07ad2a1cbdfcc6365b0db9efb2a7e74fba96778d6eafe57"),
    "thunder": ("image2.png", "53d7da64cf1f77161c1b2fe275ac8fb01860cab22db14ccd9fe892142c76a8d3"),
    "ricochet": ("image3.png", "144d437da8305f3f915d2cdb550dd2bfd799458705d146537473d95542687f81"),
    "brute": ("image4.png", "629bda317e76848a14cf9ffb1737b7260e1d7b46e76ad2c983bbbeaab13f5458"),
    "riposte": ("image5.png", "ab06345f50fc5ff2cd0ff30901c30563996fe8d3340721e16a5b241f558bbe47"),
    "critmass": ("image6.png", "7399a122d294eb87d98fba9cc31004104e8a2f7cdfa192ba07c044fa9b878101"),
    "critchain": ("image7.png", "8fc579fc8a743e25930dfc81695f24c3128126a4dcc6c8b89d65d9303bc6ab04"),
    "shove": ("image8.png", "1ac530e669f21d80af442bbf14db40cc080c635614b7702159feab52bda5372d"),
}

BOOT_ICON_SOURCES = {
    "lava": ("image1.png", "e6c965825560c25e65400a3aaeae4e30d2f0105a34d9a4bbd796f1ec23c0770e"),
    "frost": ("image2.png", "aea8833129ef1842a4bbde13c322398d32e6b2d50a37855fac1cead9c09c915d"),
    "momentum": ("image3.png", "576e5bae1523770a1e1ddd22f9624f55d4f02e02b78ae023d28588d29dd2b9a9"),
    "marathon": ("image4.png", "e216da7372c5d0b03a45574b960cadfefdbba00acb1535ec4c92c92817c030fb"),
    "panic": ("image5.png", "6bbbcc0be212e9b06172703a139bb50b6b9f7ee9957cd4333b767cd376dbaed7"),
    "sprint": ("image6.png", "dffbf7a33ea9a3c38eb852e3c24ddee4dd5b53d996f2fb4790ef8d4c3ede73fd"),
}

RING_ICON_SOURCES = {
    "exec": ("image1.png", "e0c7de3d0bdc536cf8c34608c8a8475665799c0800be9b3b64d5ceb825cdc4c4"),
    "duel": ("image2.png", "35abc9452baa6894c11bef36377211ea69efaaa0fc8e8e547876e536506a5748"),
    "reaper": ("image3.png", "a8dc8aef9b54d04c1ed0055268887ca545ff777010da04a85d2b380a29871783"),
    "siege": ("image4.png", "1e7df305183e9246d330d90974d53c1a1dbb63c0dad798397ee4d79411dee17e"),
    "headsman": ("image5.png", "8db1860f3b129bc351881a712496511aa3f32a95501f697f76044c6ef510f11f"),
    "critaim": ("image6.png", "7e635d6658399e450b86ac4132558764c082944a60c1a09c24a98fa267cfc12b"),
    "vacuum": ("image7.png", "95173b44e4d4d26a73ec9cee148cdceabcf93e75d6670852c5ed0c1e490de798"),
    "looter": ("image8.png", "10f21cc52387ea47d56ecbfb385489fb5018fcf106a554f91d0a682eb600a1f0"),
    "arrow": ("image9.png", "b5f6488c703e280e7208eea2ade8df0028aeca62c15e21c2e73ed5fe6fc241e5"),
}

RELIC_ICON_SOURCES = {
    "trinity": ("image1.png", "e38e8b5869d714057cbf4c7bd736e9d4420edf8b09616a69ffd155d9661c9f20"),
    "overload": ("image2.png", "c5d383b5bb96115e711ea7693d1187c4f063ab91174e8c2708425da5a4e176b8"),
    "breath": ("image3.png", "11062bd57d1439d988fa68e782ebcbae0fa7c2bb559ad5523401e58b63007d26"),
    "gravity": ("image4.png", "7567236c3240225d2a63ef16d559d8a88a8385dff2ebb2bf4b560d5fac8b3342"),
    "warskel": ("image5.png", "698033d26ced77b35d10893063a7003a7eaaf15ab790e7d4ea2720ef7daa9206"),
    "goldbag": ("image6.png", "d087aa014ec95cd0a8d5fd6c93a821ce5f5352d8bad1320f67ce388a7e681b17"),
    "xpbag": ("image7.png", "d65157d7d189d5d9f7504bf19b8de886b4508db96e9339e9cf748ad7c63a0581"),
}

EPIC_ITEM_SOURCES = {
    "emptyThroneSeal": ("empty-throne-seal.png", "5906f76b05858354cc75d788296e7866a73cf9bd8632d8d1f070e816a9d98a2c"),
    "surgeonsHand": ("surgeons-hand.png", "538450bed30785bdd3d3315e53e8cab6cba25067785d71841cc3b4b05d9d3f35"),
    "betweenWorldsBoots": ("between-worlds-boots.png", "3f28bc2fc7a629f21a38b7d5b63b6b5382ad7dd7d98c3164bfc94346c0c513a1"),
    "unhealedWoundRing": ("unhealed-wound-ring.png", "c4855511b69624b53d0f2d1d7e8de48b284273eb3230ed6159689163881f529e"),
    "deadGodClock": ("dead-god-clock.png", "23e166bbdbdc5c1cebb975f29e0559b54e5a3c3e32d78ceeddcacba7831d91a1"),
}

LEGENDARY_ITEM_SOURCES = {
    "heartSecond": ("heart-of-second.png", "adf9790692d4d1d12276b43be187f29a5cf316f6cb128b0078239742772b3d12"),
    "titansHands": ("titans-hands.png", "fd6ec8e28e0b4cb231f6ee36e779e56de52e44b393f95ddf5750d43161486d45"),
    "stepBeyond": ("step-beyond.png", "b8ef5d9112e1027b15cd1c684b3caf5b617e914ce79bf3d586041455f8c834ca"),
    "marchDead": ("march-of-dead.png", "5641bf935a78838743f7f24976fdee29b43a200b1c0e700e4b8686bf108042ee"),
    "zeroDistanceRing": ("zero-distance-ring.png", "6c761734bffe6b66e7f3c47e4d4101f899521885b85322b0246cf3bbbd831978"),
    "invertedCrown": ("inverted-crown.png", "aa9f582e18b409d90f7c7fa897c87c8ec60c79e3451c8226d5fd049739e07824"),
    "archivist": ("archivist.png", "efe815cc8368591ccd03b177582afc075b3a96a91e5209739660bd04eb15b68c"),
}

# Ячейки master-листа 4×3, которые действительно используются в игре.
# Первый ряд начинается с elite, третий содержит rage/pack/hit/hunter mark —
# эти пять не входят в элементальную индикацию и намеренно не упаковываются.
ENEMY_STATUS_ICON_CELLS = (
    ("burning", 1, 0),
    ("poison", 2, 0),
    ("plague", 3, 0),
    ("chilled", 0, 1),
    ("frozen", 1, 1),
    ("shocked", 2, 1),
    ("bleeding", 3, 1),
)

TOTEM_SPRITE_SOURCES = {
    "fire": (
        ("image1.png", "c95d807fc271616665f8593342241247b23c1e48cac1e3d6ee887ace7788fdd8"),
        ("image2.png", "491d750803967e1d5f31025d5f1f88e65fcf1c4c50f1d1d67f259139058afcdf"),
        ("image3.png", "acefd11b4be9b68d1c76345f8699521c987e740b87cc938c793d5838bc27e7a0"),
        ("image4.png", "43ee9564d9e402f0b86b810c4c582c504c189c0cfd6ead57e9dd0f5aff45c929"),
    ),
    "freeze": (
        ("image5.png", "98fcc540c5376c20201263971f9cedc220d162b2ec37fb3dc694403b317ef30a"),
        ("image6.png", "333577aee51a4849b83dee95b9fa5259e9e0bfeae9f6a153c2d24a9e5e1a2f89"),
        ("image7.png", "bedca9acc53f8057bf05d8ddeb03fff2bb65cfea097e86fba78084b6939d516e"),
        ("image8.png", "c1ecbb7df94f1394f621e0e89146097c613f504bbb269f4f895304d65d5a1e96"),
    ),
    "poison": (
        ("image9.png", "e50f2bf0a75f16dae4922ef850f6828bb1948910bba8fd9cf57cc51106fe949c"),
        ("image10.png", "8ef19a78fe4e0faa988aee78fcaa3752fd862d028e52a1d648174d66c75cc54b"),
        ("image11.png", "a1620f84a6cd8ca1e9fca50f9cbca7edac0f357c8dd9dfc77906370e7645f47f"),
        ("image12.png", "9c381c810369be3b6106da322b15bffa432359ada4562a144e7e3638fc622bb6"),
    ),
    "blood": (
        ("image13.png", "5e781e54703c931161eca232821db65b490fe5eb8178e1a30e44b23751d00478"),
        ("image14.png", "807a1c6741bd8142e9eb9f71cc8485c64b83617d734c1f30d9749910ba3bcf5b"),
        ("image15.png", "6515661b016316913d278b5f035f261d319d7bd06a2ac838907b702a68d2b70c"),
        ("image16.png", "5f29d917ae21b4a84e2832954c071fa7a0c344495cca06d471115274418fba7c"),
    ),
}

LIGHTNING_TOTEM_SPRITE_SOURCES = (
    ("image1.png", "56c0a666299bf7a947963b6774853137471236e5d3800deac7beaa85a95bdfff"),
    ("image2.png", "87a35500fc68a097eebc0b97e9c3f0e5c3b04142c0434fcdb273266646d1f75e"),
    ("image3.png", "6bf7dfe693a8525b07ce78a06afb513b6989e7d32b132b1e94876c85722f005a"),
    ("image4.png", "fd2f76dc62fd20da2c121caab4b7ffd1bd065ca738fbe7d630825a2a7704ced7"),
)

PUDDLE_SPRITE_SOURCES = {
    "tar": ("image1.png", "36fe13058f4744f6bc85f8691d961b2ae5a034e77ba10ab917a35b1daf860076", 32,
            "tar-pool-4f-optimized.png"),
    "ogreAcid": ("image2.png", "5812fd8f9dc0f644760967311301dec97b00b00f7ef8adc378fe4ac005fa82f7", 32,
                 "plague-ogre-acid-4f-optimized.png"),
    "bossAcid": ("image3.png", "e0b4c9d6eca4d5744731ca11930c3a4533f05f2305da9779322111e9e6ff0d0e", 64,
                 "plague-abomination-boss-acid-4f-optimized.png"),
    "boilingBlood": ("image4.png", "486bcf58e5c8a5fd3b9b795642b840658b5cee66c84ae5dc91a1f2b92d45a7bf", 32,
                     "boiling-blood-4f-optimized.png"),
    "lavaTrail": ("image5.png", "d857922d5bba16c3bd116f1b3ae826fe36d75477a57170864df3327f74ccc8bd", 32,
                  "lava-boots-fire-trail-4f-optimized.png"),
    "frostTrail": ("image6.png", "82b7368f626a1a566bc7ee54797f190984db54070843df7cf0764f4b7f4ad2cb", 32,
                   "frost-boots-ice-trail-4f-optimized.png"),
    "venomAcid": ("image7.png", "767af9cd0aa1c9ef79a6cc87f48689375c49f37422939859c5015ab61ce95109", 32,
                  "venomancer-friendly-acid-4f-optimized.png"),
    "tyrantFire": ("image8.png", "4cfb7070afb8516fb3b005e98da39928b1daf21decb40aef5b12b4a5ec7160ae", 32,
                   "horned-tyrant-fire-trail-4f-optimized.png"),
}

MENU_BACKGROUND_SOURCE_SHA256 = "3627a52e9cbd4739fbe9552cee51fab5adc240f1df17c438ef5ed78619d54192"
MENU_BACKGROUND_WEBP_SHA256 = "571683ab685f6abbb3356031c5dcfbd4ec22d8753cb8ae8d3ab6a7dbe65d3c92"
CONSTELLATION_OBSERVATORY_SOURCE_SHA256 = "05573d89ea12d0fb11fb88aac633720db173bcda2deec65bffa23beb9ff564eb"
CONSTELLATION_OBSERVATORY_WEBP_SHA256 = "16430e2fa4221af9bc0c9cf1f3242e0beff5a479715ad83be1f5d0775a48f133"
MENU_MUSIC_SHA256 = "077f237a32911f2ce4564cb39991cd2ec96d553e2ece6f87b8048dba4c0b9e2b"
CONFIRM_SOUND_SHA256 = "300084b049183ca0e8da0938208a6db95ad9ee67254fe81b2138a28cbdc2d62e"
HOVER_SOUND_SHA256 = "64b6e293a63d3e76658572c83f875f874a8b61842ed799238d41a1441a817f18"
ARCHER_SHOT_SOUND_SHA256 = (
    "2bfd7a9cf697ecfb5730d38bb20a20494b2e584aa8d0622c9ea2fdbaf869ad80",
    "a537c616742c4d4fa3919a61caf2c53ead11c3d1754aa3940ce28f9b0101cc9e",
    "1bed32779aca31427b20bcf2a5d264437c618e1778db384ffce677114a5bcf40",
    "469400e38347e51f95df933f5c58edd6d3537ccd8129ae77bdfbf47e74b97231",
)
WARRIOR_ATTACK_SOUND_SHA256 = (
    "3a72d4a60fa8d79d98001586f89084ee391ed9766d80bb97b2271afc57b0d5c5",
    "3ef1fe28c3797bd4427aa0766f6d8f51dd4c4a4f8aa31216a89b1c550b75f82b",
    "609857aac108498a369327cd6bf3f73e8c2a51840f452e644afeb65844edce41",
    "14348e52d7e875ea1e05f27655b232ef63bdee975438c3390e45611bc903d315",
)
MAGE_ATTACK_SOUND_SHA256 = (
    "3b6baf3457eb7fc4bc3d0edcbccc9b670f5a3019e6566f18ea91493c3a14baee",
    "2f705e4eb6720aec80e4480b7d1fd7e2b5b37a71ced16b7cb6c052ecbcf6390f",
    "442afd04d92987bb9eb4d90f1fd06b8dc93a62afcb673cdb6bcf98b19319ebed",
    "013d99d1bfdb688ad9e6f85e10c2bf579bbb9740f66855bacad76cbfba9c2417",
)

CLASS_FRAME_SOURCES = {
    "archer": ("word/media/image3.png", "4413b6f02e7ae495f2215d055b79f178501face7647d971c60e40c2a40079307"),
    "mage": ("word/media/image5.png", "ed3db3d7ee5908bceaaa4c8a5a1d62471c293ecffabdd2e3a619f16b1e078ea9"),
    "necromancer": ("word/media/image7.png", "ad14eaf3682edce941930793328042befad58b2da5192f326fbb582f60779f55"),
    "warrior": ("word/media/image9.png", "7a6b86d2331f1d41f1b8aa0e02cc001ccb345d1aed6b450a4d63f573e11686ea"),
}

SUBCLASS_FRAME_SOURCES = {
    "thief": ("thief.png", "e048b609183aecdd227e5c5f7660eebae404ae7b4f52cfa174372f1094f9bbe4"),
    "hunter": ("hunter.png", "2646734140caf0f76b3fdf67753de267b2a7d739d04a585a1f36f95e1443f5f1"),
    "dancer": ("dancer.png", "688f33cef2175494ef5d7fa0ddaac5f66272ed21a78c864fb6c0e3b383e1756e"),
    "destroyer": ("destroyer.png", "047d599d33624b4189e58c882047930c457b406572c8ba1beefbd6084408100b"),
    "multiplier": ("multiplier.png", "cf9832fef0432815558e3a1aa1c1d0976d31f01d7118b292da7593fc604d372b"),
    "elementalist": ("elementalist.png", "ad68ce59963084f48eaac69a1141a148da28f351421319b7677b19c4cf6c48c4"),
    "graverobber": ("graverobber.png", "0906839f93a0bdca56dca26cba38d044c4f2ccbf86ee9c2d0205126127dfd2d4"),
    "animator": ("animator.png", "a9fda6732ac4c70e23d51e8612baea321e24fef99340fbcb8c321e7bc4833192"),
    "venomancer": ("venomancer.png", "bdd868a23304abbd37f617b8b7feeecfb480ea4418ad47e5e81d7bdfc5b8497e"),
    "berserker": ("berserker.png", "39959c78dbb3a54a77d1d9f640ac502431c1600e0d37655b7b4045bcfaa0ea12"),
    "guardian": ("guardian.png", "e8a963e9e8176992347ab6d7f9e0245d782724a26d3e87d429993fc85ecdda7e"),
    "swordmaster": ("swordmaster.png", "0c5b1eb557420111b2185b5fe82d590e6a74f2f3d9035dc977e65c8020436f2a"),
}

# Пять готовых рамок карточек навыков из handoff. Исходник 304x194 не
# подгоняется под одну высоту карточки: runtime использует его как CSS 9-slice,
# поэтому углы остаются 1:1, а прямые участки адаптируются к содержимому.
SKILL_CARD_FRAME_SOURCES = {
    "common": ("word/media/image1.png", "2eab5929745b6f85b243502858d277f434b34fd65c8ed0de79ab241a23d759f4"),
    "rare": ("word/media/image2.png", "3d87b3d1b08ab572c1f14f85391a702099f6621d9f182acb9f3fb9319e50ad0f"),
    "epic": ("word/media/image3.png", "91408d0448ab5e93c2b85634e87750647a34c758e7b1f7f8cbdc408976393606"),
    "key": ("word/media/image4.png", "744ac5e0d75a0214231860aedf116f89e774ce25f5567761de632442cead6138"),
    "blood": ("word/media/image5.png", "a1b0dedc5cdf3a5cbd2b7f192727e256c7a5bb24809555047b585669169669b0"),
}

# 10-кадровые горизонтальные листы эмблем из handoff главного меню. Каждый
# исходный кадр 256×256 уменьшается до 128×128: этого достаточно для HiDPI-
# превью 96 CSS px, а декодированная память снижается в четыре раза.
CLASS_ICON_SHEET_SOURCES = {
    "archer": ("word/media/image7.png", "6a36a2ed8651dcabbaea497954ef1293ce4235327027967b4a33a42f11011a01"),
    "mage": ("word/media/image8.png", "b8cd42482e6788eee8696daed421fb74a8545489109f4032cafec14b62855433"),
    "necromancer": ("word/media/image9.png", "d056f844be0e3479fcba387fcacbac77127c029f66ef6b4c6daebb8c8c1415e9"),
    "warrior": ("word/media/image10.png", "0b8b2c4c507dfb371d11322dacbb61ad239135414a10d3cbd08505b06f8a7637"),
}

# Готовые игровые листы V4: восемь кадров движения строго вправо 36×36.
# Герои и их крупные превью — контролируемое исключение до 192 индексов:
# повторный ресэмплинг/квантизация запрещены, меню использует те же PNG-байты.
SUBCLASS_HERO_SPRITE_SOURCES = {
    "thief": ("thief.png", "c8618541a7146d630673dd553af7c2f509bb51d708601b185c072e764ca6cff5"),
    "hunter": ("hunter.png", "9d549d76bf41e498372dd4cfb2b942999eca4095b347e62e76e2c7c94de25b18"),
    "dancer": ("dancer.png", "c0bd26b4f3275181623667f3f79e28297c01e8fe36ce255f938723f8ab225258"),
    "destroyer": ("destroyer.png", "e7302047110866e912865b23e0316ffc484c8d3181b33ba7bb8328c127cc8ff0"),
    "multiplier": ("multiplier.png", "13210a1bb4e33bb0e83aad4d69b9f9cbc3295e9aeac93baa146bd4668f0d123c"),
    "elementalist": ("elementalist.png", "feab017d267dbee08d5bc37a8e58930e1137da84fc6ed4c4fee446c8a6871d9f"),
    "graverobber": ("graverobber.png", "bff9cf5ecf69ac81d7dd590309ee1b57c58fad1136deadc6b3cd3533b68ad1f4"),
    "animator": ("animator.png", "b08d0a2f7b9153809dda2efc46574619dc91defadccfb1455307d960745dd490"),
    "venomancer": ("venomancer.png", "55e30cf7c5f81a66ea6a4983ea23549cf7bb0b0e641912dfd91c24ec08eb71be"),
    "berserker": ("berserker.png", "9dc847439b05ff7d02c71d969563247050f7767afd54d87fd6f3b44d4057300c"),
    "guardian": ("guardian.png", "91379c86271516c8e0d0f8e6afc68b53ee91717054abace97145f783c8f1a34d"),
    "swordmaster": ("swordmaster.png", "85ff4ec6e73ad9462530a4b2b8f428b91fbc783eaa29402c16b927db86d791f8"),
}

# Готовые листы из handoff системы крови. Они уже имеют игровой размер,
# прозрачность и крошечную палитру, поэтому повторное квантование только
# увеличило бы риск артефактов. Установщик проверяет байты и геометрию.
BLOOD_SPRITE_SOURCES = {
    "splash": ("blood_splash_4f.png",
               "0c46d1b3fcfa342fa716f0dddad2883ec2330693d9c9dcbe22afcaae4a1a15c7",
               (256, 64)),
    "mist": ("blood_mist_4f.png",
             "20373938f43fbb76cc12cb561dda6608d79fc55a3c5f7f15187bf350308bd645",
             (256, 64)),
    "critSpray": ("blood_crit_spray_4f.png",
                  "41a610189de18e62c0e5ae5566a0809fc237f7d3fd37c37de5fbef107e3e122b",
                  (128, 32)),
    "decals": ("blood_decal_atlas_8x.png",
               "cd0ef52397dfed2e376f05545221fe14b136b678d106128ce0d1e11bafcbf174",
               (256, 128)),
}

# Статичные трупы из handoff DOCX. Источники проверяются побайтно, затем для
# runtime уменьшаются ровно вдвое и проходят alpha-aware очистку светлого matte.
# Это устраняет белые пиксели на прозрачном контуре и совпадает с масштабом
# живых монстров, сохраняя полноцветный RGBA без палитровой квантизации.
CORPSE_SPRITE_SOURCES = {
    "blob": ("word/media/image1.png", "963811c5bc160f7f72fb9b76dfb9d10fa09ecf70afe8bf98d3206bc65140f8ff", (96, 54)),
    "runner": ("word/media/image2.png", "26a786b7843366d311026a33cef0b0e4b3c0c368b239793ca3776aa9c26860cd", (96, 46)),
    "tank": ("word/media/image3.png", "a5cc79b611798357f3f2b271420e88e61842a3fb3a7c512a5b916a9d0f0e3052", (96, 51)),
    "shooter": ("word/media/image4.png", "a1063b45f0540c03a3795c1410d8ace3edc474709a5767accb3ea484beffe0aa", (84, 64)),
    "frostWolf": ("word/media/image5.png", "982b2b39a6b6cb73ed99d6fa1ef746e24e0cbdc520308b80794752cfa6569542", (112, 54)),
    "toxicRunner": ("word/media/image6.png", "1ef650ae929475f113a81cafa9e7c08cab445b04c7c0ac173c14d949f8a6c4cd", (112, 53)),
    "cursedRogue": ("word/media/image7.png", "ad220e78f5b966050b6bac9c8ffbe1c9938df901e54fad1f59e36447a2301e4f", (112, 45)),
    "skeletonWarrior": ("word/media/image8.png", "8b6b1652563652c61b9544d0b50c48566938e493dedc4fb015b97c1f78d06f57", (112, 50)),
    "blightGrunt": ("word/media/image9.png", "39ee92d7a1600564ba9c3f38b1afddcd0215503f5e6941eaaad7d1ac233dbb33", (112, 52)),
    "boneGargoyle": ("word/media/image10.png", "cbf3f3284badf41f3370dbf9b174483d724f9f4e441ba1fd643c1026a350c536", (112, 53)),
    "fallenPyromancer": ("word/media/image11.png", "2da58035f23a29e4eff5c4d3918065bc24ee26fc2f2026afefdd909c4401ff07", (112, 68)),
    "beholderSlave": ("word/media/image12.png", "7cc0678b49693c2704449da2a4f987cb785f0ff284400f7c391127556e50ffc9", (112, 67)),
    "skeletonCrossbow": ("word/media/image13.png", "3a3c6ba3d96bf206f434c6495001f3906dd39f05c582ca71362b2e0a5ec53c24", (112, 46)),
    "forgottenGuard": ("word/media/image14.png", "5ced20c539674ff3da260995a1e47434a8b6aa05f2e631d641aa2bcb954eb1d8", (112, 63)),
    "abyssalExecutioner": ("word/media/image15.png", "0980449c06fbfb0eb75d1ed7926a777ee960923ae14932973ff16b14f95922bf", (112, 52)),
    "plagueOgre": ("word/media/image16.png", "f682f7cf852de7efa26d93bd7751ba4aac3a5801738ae87fc89f662f8772d52e", (112, 57)),
    "lich": ("word/media/image17.png", "075540628a321e45f6b41be83d8a8316c3538258aa511b771c3e5c2def27d071", (144, 60)),
    "goat": ("word/media/image18.png", "a1f7accc304852d1f146d60bbeab1bc10921ad0bbecbe96a41a4942286594d84", (144, 68)),
    "plague": ("word/media/image19.png", "099dd0954bda603460de1deb0748472f4a5bc58435c4af7a19b31d3f8c3cdced", (144, 66)),
    "greed": ("word/media/image20.png", "f4f5ee9cd8b0cd2e95c75d4a0105d9741a4f44e45212ad3407a9c6541a7b41b0", (144, 66)),
    "executioner": ("word/media/image21.png", "2b129f86f31538db01c34248bfa642245f9364cc74b9a765a3b83cc67651204b", (144, 57)),
    "tyrant": ("word/media/image22.png", "322f090f64709183311f6a42e2cf421cc7600f2ac3edd9eb316f217e08e1cd69", (144, 71)),
    "grave": ("word/media/image23.png", "5093fcdc82a92069bfe4b5efbb0b43d094820d9104aa59c8a153dcfcc83b48c0", (144, 62)),
    "behemoth": ("word/media/image24.png", "88557d38cfa09f8c59db25e6354f30b92f2544c35527975742f6f251bcde531c", (144, 71)),
    "vampire": ("word/media/image25.png", "de18106d4258c14421f1c393e9e17f2bebc896c0282135bf04549765c319216a", (144, 64)),
    "voidwrath": ("word/media/image26.png", "29113e96500d32fc71a62adef002939211e315774dff185dba8bcb4af5c077ef", (144, 70)),
    "minotaur": ("word/media/image27.png", "ed27cbf70777989bc4e1fbc15f25b5d6ac5543be223edd9658ae0965195ba7b7", (144, 67)),
    "seraph": ("word/media/image28.png", "3795c89c4e174db3674735f7bd9299b49803aabf1e1a8451dbf5d1792719db4b", (144, 66)),
    "matriarch": ("word/media/image29.png", "f41a5f0b7ce5428b54d3556b928d0f8ba1e993adad536391cd6b29736cc311f2", (144, 64)),
    "demonqueen": ("word/media/image30.png", "b4ac1721a88e4ce4b09023885a6dc6f77d66463004ff5b1295754a7120f9f607", (144, 60)),
}

CORPSE_PUDDLE_ATLAS_SHA256 = "9236e97ebaf2e4cee306cf305d5eaaae47b2cdc1857b7b75c19cc9efc3f20049"


def corpse_bright_edge_cleanup(image: Image.Image) -> Image.Image:
    """Replace neutral-white edge matte with nearby corpse color, never white."""
    rgba = image.convert("RGBA")
    source = rgba.load()
    cleaned = rgba.copy()
    target = cleaned.load()

    def bright_neutral(pixel: tuple[int, int, int, int]) -> bool:
        r, g, b, a = pixel
        return a >= 8 and min(r, g, b) >= 185 and max(r, g, b) - min(r, g, b) <= 58

    for y in range(rgba.height):
        for x in range(rgba.width):
            pixel = source[x, y]
            if not bright_neutral(pixel):
                if pixel[3] == 0 and pixel[:3] != (0, 0, 0):
                    target[x, y] = (0, 0, 0, 0)
                continue
            edge = any(
                source[nx, ny][3] < 8
                for ny in range(max(0, y - 1), min(rgba.height, y + 2))
                for nx in range(max(0, x - 1), min(rgba.width, x + 2))
                if nx != x or ny != y
            )
            if not edge:
                continue
            replacement = None
            for radius in range(1, 5):
                candidates = []
                for ny in range(max(0, y - radius), min(rgba.height, y + radius + 1)):
                    for nx in range(max(0, x - radius), min(rgba.width, x + radius + 1)):
                        candidate = source[nx, ny]
                        if candidate[3] >= 48 and not bright_neutral(candidate):
                            candidates.append(((nx - x) ** 2 + (ny - y) ** 2, candidate))
                if candidates:
                    replacement = min(candidates, key=lambda item: item[0])[1]
                    break
            if replacement:
                target[x, y] = (*replacement[:3], pixel[3])
            else:
                target[x, y] = (0, 0, 0, 0)
    return cleaned


def corpse_half_size_png(image: Image.Image) -> bytes:
    """Clean matte, alpha-aware downsample to 50%, then emit full RGBA PNG."""
    clean = corpse_bright_edge_cleanup(image)
    alpha = clean.getchannel("A")
    premultiplied = Image.merge("RGBA", tuple(
        ImageChops.multiply(clean.getchannel(channel), alpha) for channel in "RGB"
    ) + (alpha,))
    size = (clean.width // 2, (clean.height + 1) // 2)
    resized = premultiplied.resize(size, Image.Resampling.LANCZOS)
    pixels = []
    for red, green, blue, out_alpha in resized.getdata():
        if out_alpha <= 1:
            pixels.append((0, 0, 0, 0))
        else:
            pixels.append((
                min(255, round(red * 255 / out_alpha)),
                min(255, round(green * 255 / out_alpha)),
                min(255, round(blue * 255 / out_alpha)),
                out_alpha,
            ))
    output = Image.new("RGBA", size)
    output.putdata(pixels)
    output = corpse_bright_edge_cleanup(output)
    buffer = io.BytesIO()
    output.save(buffer, "PNG", optimize=True, compress_level=9)
    return buffer.getvalue()

SHOP_ICON_ATLAS_SOURCE_SHA256 = "f05fb7c14b4e46e542de12f103c8f8a41c059c7410211694b6408641a51843ad"


def shop_icon_atlas(path: Path) -> bytes:
    """Свести сгенерированную сетку 5×4 к одному игровому PNG 240×192."""
    source_data = path.read_bytes()
    actual_hash = hashlib.sha256(source_data).hexdigest()
    if actual_hash != SHOP_ICON_ATLAS_SOURCE_SHA256:
        raise SystemExit(
            f"атлас магазина: SHA-256 {actual_hash}, ожидался {SHOP_ICON_ATLAS_SOURCE_SHA256}")
    source = Image.open(io.BytesIO(source_data)).convert("RGBA")
    if source.size != (1402, 1122):
        raise SystemExit(f"атлас магазина: ожидался размер 1402×1122, получен {source.size}")
    sheet = Image.new("RGBA", (240, 192))
    for row in range(4):
        for col in range(5):
            cell = source.crop((
                round(col * source.width / 5), round(row * source.height / 4),
                round((col + 1) * source.width / 5), round((row + 1) * source.height / 4),
            )).resize((48, 48), Image.Resampling.LANCZOS)
            sheet.alpha_composite(cell, (col * 48, row * 48))
    return indexed_png(sheet, opaque_colors=255, transparent_index=255, bits=8)


def indexed_png(image: Image.Image, opaque_colors: int = PALETTE_COLORS,
                transparent_index: int = TRANSPARENT_INDEX, bits: int = 4) -> bytes:
    """Свести RGBA к индексированной PNG с отдельным прозрачным индексом."""
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    mask = alpha.point(lambda value: 255 if value >= 64 else 0)
    rgb = Image.new("RGB", rgba.size, (0, 0, 0))
    rgb.paste(rgba.convert("RGB"), mask=mask)
    pal = rgb.quantize(colors=opaque_colors, method=Image.Quantize.MEDIANCUT,
                       dither=Image.Dither.NONE)
    palette = list(pal.getpalette() or [])
    palette.extend([0] * (768 - len(palette)))
    palette[transparent_index * 3:transparent_index * 3 + 3] = [0, 0, 0]
    pal.putpalette(palette)
    pixels = bytearray(pal.tobytes())
    mask_bytes = mask.tobytes()
    for index, opaque in enumerate(mask_bytes):
        if not opaque:
            pixels[index] = transparent_index
    out = Image.frombytes("P", pal.size, bytes(pixels))
    out.putpalette(palette)
    out.info["transparency"] = transparent_index
    buffer = io.BytesIO()
    out.save(buffer, "PNG", optimize=True, compress_level=9, bits=bits,
             transparency=transparent_index)
    return buffer.getvalue()


def indexed_rgba_png(image: Image.Image, colors: int = FRAME_PALETTE_COLORS) -> bytes:
    """Свести UI-иллюстрацию к индексированной PNG, сохранив градации альфы."""
    if not 2 <= colors <= 256:
        raise ValueError(f"палитра RGBA PNG должна содержать от 2 до 256 цветов, получено {colors}")
    rgba = image.convert("RGBA")
    pal = rgba.quantize(colors=colors, method=Image.Quantize.FASTOCTREE,
                        dither=Image.Dither.NONE)
    buffer = io.BytesIO()
    # Рамки крупнее пиксельных спрайтов: таблица tRNS сохраняет мягкий край,
    # но итоговый PNG всё равно остаётся индексированным color type 3.
    pal.save(buffer, "PNG", optimize=True, compress_level=9, bits=8)
    return buffer.getvalue()


def class_icon_sheet(source: Image.Image) -> bytes:
    """Уменьшить 10 кадров эмблемы отдельно и собрать компактный лист 1280×128."""
    rgba = source.convert("RGBA")
    if rgba.size != (2560, 256):
        raise ValueError(f"ожидался лист 2560×256, получен {rgba.size}")
    sheet = Image.new("RGBA", (1280, 128))
    for frame_index in range(10):
        frame = rgba.crop((frame_index * 256, 0, (frame_index + 1) * 256, 256))
        frame = frame.resize((128, 128), Image.Resampling.LANCZOS)
        sheet.alpha_composite(frame, (frame_index * 128, 0))
    return indexed_rgba_png(sheet)


def fit_frame(source: Image.Image, size: tuple[int, int], padding: int = 1) -> Image.Image:
    """Обрезать прозрачные поля и вписать силуэт в маленький фиксированный кадр."""
    rgba = source.convert("RGBA")
    alpha = rgba.getchannel("A").point(lambda value: 255 if value >= 16 else 0)
    box = alpha.getbbox()
    if not box:
        return Image.new("RGBA", size)
    crop = rgba.crop(box)
    max_w, max_h = size[0] - padding * 2, size[1] - padding * 2
    ratio = min(max_w / crop.width, max_h / crop.height)
    new_size = (max(1, round(crop.width * ratio)), max(1, round(crop.height * ratio)))
    crop = crop.resize(new_size, Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", size)
    x = (size[0] - new_size[0]) // 2
    y = size[1] - padding - new_size[1]
    frame.alpha_composite(crop, (x, y))
    return frame


def hero_sheet(path: Path) -> bytes:
    source = Image.open(path).convert("RGBA")
    sheet = Image.new("RGBA", (128, 32))
    for frame_index in range(4):
        x0 = round(frame_index * source.width / 4)
        x1 = round((frame_index + 1) * source.width / 4)
        frame = fit_frame(source.crop((x0, 0, x1, source.height)), (32, 32))
        sheet.alpha_composite(frame, (frame_index * 32, 0))
    return indexed_png(sheet)


def four_frame_sheet(path: Path, frame_size: int, padding: int) -> bytes:
    """Разделить горизонтальный источник на 4 кадра и упаковать без лишних полей."""
    source = Image.open(path).convert("RGBA")
    sheet = Image.new("RGBA", (frame_size * 4, frame_size))
    for frame_index in range(4):
        x0 = round(frame_index * source.width / 4)
        x1 = round((frame_index + 1) * source.width / 4)
        frame = fit_frame(source.crop((x0, 0, x1, source.height)),
                          (frame_size, frame_size), padding=padding)
        sheet.alpha_composite(frame, (frame_index * frame_size, 0))
    return indexed_png(sheet)


def loot_sprite_sheet(path: Path, frame_size: int) -> bytes:
    """Упаковать четыре фазы наземного лута через единый transform.

    Общая alpha-рамка сохраняет неподвижными корпус монеты, кристалла или книги,
    а nearest-neighbor не размывает пиксельный силуэт на целевых 16/24 px.
    """
    source = Image.open(path).convert("RGBA")
    frames = split_horizontal_frames(source, 4)
    sheet = compact_stable_sheet(
        frames, (frame_size, frame_size), padding=0,
        resample=Image.Resampling.NEAREST)
    return indexed_png(sheet)


def rare_item_sprite(path: Path) -> bytes:
    """Свести статичный редкий предмет к читаемому холсту 24×24.

    Один прозрачный пиксель со всех сторон защищает край силуэта, nearest-neighbor
    сохраняет исходную пиксельную ступеньку, а indexed_png делает альфу жёсткой.
    """
    source = Image.open(path).convert("RGBA")
    alpha = source.getchannel("A").point(lambda value: 255 if value >= 16 else 0)
    box = alpha.getbbox()
    if not box:
        raise SystemExit(f"Пустой предмет: {path}")
    crop = source.crop(box)
    ratio = min(22 / crop.width, 22 / crop.height)
    size = (max(1, round(crop.width * ratio)), max(1, round(crop.height * ratio)))
    crop = crop.resize(size, Image.Resampling.NEAREST)
    frame = Image.new("RGBA", (24, 24))
    frame.alpha_composite(crop, ((24 - size[0]) // 2, (24 - size[1]) // 2))
    return indexed_png(frame)


def enemy_status_icon_sheet(path: Path) -> bytes:
    """Вырезать семь элементальных иконок из master 4×3 в лист 112×16."""
    source = Image.open(path).convert("RGBA")
    if source.width % 4 or source.height % 3:
        raise SystemExit("Master индикаторов должен быть ровной сеткой 4×3")
    cell_w, cell_h = source.width // 4, source.height // 3
    sheet = Image.new("RGBA", (16 * len(ENEMY_STATUS_ICON_CELLS), 16))
    for index, (_, column, row) in enumerate(ENEMY_STATUS_ICON_CELLS):
        cell = source.crop((column * cell_w, row * cell_h,
                            (column + 1) * cell_w, (row + 1) * cell_h))
        sheet.alpha_composite(fit_frame(cell, (16, 16), padding=1), (index * 16, 0))
    return indexed_png(sheet)


FLOOR_PORTAL_SPRITE_SHA256 = "13ee7db299978f4753c6bb63fe6466bdae3e1e69a6eac71d00e697851a868d8b"


def floor_portal_sprite_sheet(path: Path) -> bytes:
    """Проверить и вернуть нативный RGBA-лист портала 8×128 без перекодирования."""
    data = path.read_bytes()
    actual = hashlib.sha256(data).hexdigest()
    if actual != FLOOR_PORTAL_SPRITE_SHA256:
        raise SystemExit(
            f"Лист портала: SHA-256 {actual}, ожидался {FLOOR_PORTAL_SPRITE_SHA256}")
    source = Image.open(io.BytesIO(data))
    if source.mode != "RGBA" or source.size != (1024, 128):
        raise SystemExit(
            f"Лист портала должен быть RGBA 1024×128 (8 кадров по 128×128), "
            f"получено {source.mode} {source.size}")
    for index in range(8):
        frame = source.crop((index * 128, 0, (index + 1) * 128, 128))
        if not frame.getchannel("A").getbbox():
            raise SystemExit(f"Лист портала: кадр {index + 1} пуст")
    return data


def totem_sprite(path: Path) -> bytes:
    """Свести один rank-specific Master к прозрачной индексированной иконке 24×24."""
    source = Image.open(path).convert("RGBA")
    alpha = source.getchannel("A").point(lambda value: 255 if value >= 16 else 0)
    box = alpha.getbbox()
    if not box:
        raise SystemExit(f"Пустой Master тотема: {path}")
    crop = source.crop(box)
    ratio = min(22 / crop.width, 22 / crop.height)
    size = (max(1, round(crop.width * ratio)), max(1, round(crop.height * ratio)))
    crop = crop.resize(size, Image.Resampling.NEAREST)
    frame = Image.new("RGBA", (24, 24))
    frame.alpha_composite(crop, ((24 - size[0]) // 2, 23 - size[1]))
    return indexed_png(frame)


def separated_horizontal_frames(path: Path, count: int = 4) -> list[Image.Image]:
    """Вырезать персонажей по настоящим прозрачным промежуткам листа.

    Присланные листы свиты не используют равные ячейки: широкие позы и оружие
    местами пересекают границы четвертей. Проекция alpha сохраняет силуэт целиком.
    """
    source = Image.open(path).convert("RGBA")
    alpha = source.getchannel("A").point(lambda value: 255 if value >= 16 else 0)
    occupied = [x for x in range(source.width)
                if alpha.crop((x, 0, x + 1, source.height)).getbbox()]
    runs: list[list[int]] = []
    for x in occupied:
        if not runs or x - runs[-1][1] > 4:
            runs.append([x, x])
        else:
            runs[-1][1] = x
    if len(runs) != count:
        raise SystemExit(f"{path.name}: ожидалось {count} силуэтов, найдено {len(runs)}")
    frames = []
    for left, right in runs:
        box = alpha.crop((left, 0, right + 1, source.height)).getbbox()
        if not box:
            raise SystemExit(f"{path.name}: пустой кадр свиты")
        frames.append(source.crop((left + box[0], box[1], left + box[2], box[3])))
    return frames


def minion_sheet(path: Path, frame_size: int) -> bytes:
    """Стабильный четырёхкадровый лист свиты в её экранном бюджете."""
    subjects = separated_horizontal_frames(path)
    canvas_size = (max(frame.width for frame in subjects),
                   max(frame.height for frame in subjects))
    aligned = []
    for subject in subjects:
        frame = Image.new("RGBA", canvas_size)
        frame.alpha_composite(subject, ((canvas_size[0] - subject.width) // 2,
                                        canvas_size[1] - subject.height))
        aligned.append(frame)
    return indexed_png(compact_stable_sheet(aligned, (frame_size, frame_size), padding=0))


def shooter_sheet(path: Path) -> bytes:
    return four_frame_sheet(path, 40, 1)


def shooter_projectile_sheet(path: Path) -> bytes:
    return four_frame_sheet(path, 8, 0)


def archer_projectile(path: Path) -> bytes:
    """Одна стрела 12×6: чуть сжимаем пропорции ради читаемого оперения в 12 px."""
    source = Image.open(path).convert("RGBA")
    alpha = source.getchannel("A").point(lambda value: 255 if value >= 16 else 0)
    box = alpha.getbbox()
    if not box:
        raise SystemExit("Источник стрелы не содержит непрозрачных пикселей")
    frame = source.crop(box).resize((12, 6), Image.Resampling.NEAREST)
    return indexed_png(frame)


def mage_projectile_sheet(path: Path) -> bytes:
    return four_frame_sheet(path, 8, 0)


def plague_slime_projectile_sheet(path: Path) -> bytes:
    """Четыре фазы сгустка Чумной мерзости в экранном бюджете 20 px."""
    return four_frame_sheet(path, 20, 0)


def emerald_orb_projectile_sheet(path: Path) -> bytes:
    """Четыре фазы большой сферы Лича в экранном бюджете 32 px."""
    return four_frame_sheet(path, 32, 0)


def greed_spear_projectile_sheet(path: Path) -> bytes:
    """Четыре стабильные фазы длинного Копья жадности по 64×20."""
    source = Image.open(path).convert("RGBA")
    frames = split_horizontal_frames(source, 4)
    return indexed_png(compact_stable_sheet(frames, (64, 20), padding=0))


def executioner_axe_projectile_sheet(path: Path) -> bytes:
    """Восемь центрированных фаз вращающегося топора по 56×56."""
    subjects = separated_horizontal_frames(path, 8)
    canvas_size = (max(frame.width for frame in subjects),
                   max(frame.height for frame in subjects))
    centered = []
    for subject in subjects:
        frame = Image.new("RGBA", canvas_size)
        frame.alpha_composite(subject, ((canvas_size[0] - subject.width) // 2,
                                        (canvas_size[1] - subject.height) // 2))
        centered.append(frame)
    return indexed_png(compact_stable_sheet(centered, (56, 56), padding=1))


def minotaur_spear_projectile_sheet(path: Path) -> bytes:
    """Четыре стабильные фазы Копья Минотавра по 64×20."""
    source = Image.open(path).convert("RGBA")
    frames = split_horizontal_frames(source, 4)
    return indexed_png(compact_stable_sheet(frames, (64, 20), padding=0))


def seraph_holy_spear_sheet(path: Path) -> bytes:
    """Четыре стабильные фазы Святого Копья по 96×32."""
    source = Image.open(path).convert("RGBA")
    frames = split_horizontal_frames(source, 4)
    return indexed_png(compact_stable_sheet(frames, (96, 32), padding=0))


def demon_queen_blob_sheet(path: Path) -> bytes:
    """Четыре центрированные фазы Демонического сгустка по 32×32."""
    source = Image.open(path).convert("RGBA")
    frames = split_horizontal_frames(source, 4)
    return indexed_png(compact_stable_sheet(frames, (32, 32), padding=0))


def matriarch_plague_projectile_sheet(path: Path) -> bytes:
    """Четыре стабильные фазы Чумного снаряда Матриархии по 32×32."""
    source = Image.open(path).convert("RGBA")
    frames = split_horizontal_frames(source, 4)
    return indexed_png(compact_stable_sheet(frames, (32, 32), padding=0))


def void_ground_rift_sheet(path: Path) -> bytes:
    """Четыре стабильные фазы наземного Разлома Пустоты по 64×64."""
    source = Image.open(path).convert("RGBA")
    frames = split_horizontal_frames(source, 4)
    return indexed_png(compact_stable_sheet(frames, (64, 64), padding=0))


def arcane_mine_sprite(path: Path) -> bytes:
    """Свести присланную мину к маленькому читаемому кадру 32×32."""
    source = Image.open(path).convert("RGBA")
    return indexed_png(fit_frame(source, (32, 32), padding=1))


def arcane_mine_explosion_sheet(path: Path) -> bytes:
    """Упаковать восемь фаз взрыва с единым масштабом и неподвижным центром."""
    source = Image.open(path).convert("RGBA")
    frames = split_horizontal_frames(source, 8)
    return indexed_png(compact_stable_sheet(frames, (64, 64)))


def remove_dark_background(source: Image.Image) -> Image.Image:
    """Убрать непрозрачный чёрный фон, сохранив цветные пиксели свечения."""
    rgba = source.convert("RGBA")
    pixels = []
    for red, green, blue, _ in rgba.get_flattened_data():
        high = max(red, green, blue)
        alpha = 0 if high < 30 else min(255, max(0, round((high - 24) * 5)))
        pixels.append((red, green, blue, alpha))
    rgba.putdata(pixels)
    return rgba


def compact_centered_sheet(frames: list[Image.Image],
                           frame_size: tuple[int, int], padding: int = 2) -> Image.Image:
    """Один масштаб и неподвижный центр для фаз кругового взрыва."""
    boxes = [frame.getchannel("A").point(
        lambda value: 255 if value >= 16 else 0).getbbox() for frame in frames]
    if any(box is None for box in boxes):
        raise SystemExit("Пустой кадр магического эффекта")
    shared = (min(box[0] for box in boxes), min(box[1] for box in boxes),
              max(box[2] for box in boxes), max(box[3] for box in boxes))
    width, height = shared[2] - shared[0], shared[3] - shared[1]
    ratio = min((frame_size[0] - padding * 2) / width,
                (frame_size[1] - padding * 2) / height, 1)
    size = (max(1, round(width * ratio)), max(1, round(height * ratio)))
    x = (frame_size[0] - size[0]) // 2
    y = (frame_size[1] - size[1]) // 2
    sheet = Image.new("RGBA", (frame_size[0] * len(frames), frame_size[1]))
    for index, frame in enumerate(frames):
        crop = frame.crop(shared)
        if crop.size != size:
            crop = crop.resize(size, Image.Resampling.LANCZOS)
        sheet.alpha_composite(crop, (index * frame_size[0] + x, y))
    return sheet


def mage_ability_sheet(path: Path, count: int, light_background: bool = False,
                       saturation: float = 1.0) -> bytes:
    """Очистить фон и собрать центрированный лист взрыва 64 px на кадр."""
    source = Image.open(path)
    source = remove_logo_checker(source) if light_background else remove_dark_background(source)
    if saturation != 1:
        alpha = source.getchannel("A")
        source = ImageEnhance.Color(source.convert("RGB")).enhance(saturation).convert("RGBA")
        source.putalpha(alpha)
    frames = split_horizontal_frames(source, count)
    return indexed_png(compact_centered_sheet(frames, (64, 64)))


ENEMY_FRAMES = {
    "runner": [(20, 115, 555, 455), (665, 115, 370, 455),
               (1070, 115, 575, 455), (1755, 115, 370, 455)],
    "blob": [(41, 170, 398, 490), (491, 170, 415, 490),
             (954, 170, 400, 490), (1411, 170, 418, 490)],
    "tank": [(14, 216, 396, 470), (448, 216, 377, 470),
             (875, 216, 399, 470), (1319, 216, 378, 470)],
}
ENEMY_FRAME_SIZE = {"runner": 40, "blob": 40, "tank": 48}


def enemy_sheet(source: Image.Image, key: str) -> bytes:
    size = ENEMY_FRAME_SIZE[key]
    sheet = Image.new("RGBA", (size * 4, size))
    for index, (x, y, width, height) in enumerate(ENEMY_FRAMES[key]):
        frame = fit_frame(source.crop((x, y, x + width, y + height)), (size, size))
        sheet.alpha_composite(frame, (index * size, 0))
    return indexed_png(sheet)


def boss_sheet(source: Image.Image) -> bytes:
    sheet = Image.new("RGBA", (256, 96))
    for index in range(4):
        frame = source.crop((index * 128, 0, (index + 1) * 128, 192))
        frame = frame.resize((64, 96), Image.Resampling.LANCZOS)
        sheet.alpha_composite(frame, (index * 64, 0))
    return indexed_png(sheet)


def new_boss_sheet(path: Path) -> bytes:
    """Четыре больших прозрачных кадра из горизонтального исходника → 64×96 каждый."""
    source = Image.open(path).convert("RGBA")
    sheet = Image.new("RGBA", (256, 96))
    for index in range(4):
        x0 = round(index * source.width / 4)
        x1 = round((index + 1) * source.width / 4)
        frame = fit_frame(source.crop((x0, 0, x1, source.height)), (64, 96), padding=1)
        sheet.alpha_composite(frame, (index * 64, 0))
    return indexed_png(sheet)


def coin_sheet(source: Image.Image) -> bytes:
    sheet = Image.new("RGBA", (32, 8))
    for index in range(4):
        frame = source.crop((index * 24, 0, (index + 1) * 24, 24))
        frame = fit_frame(frame, (8, 8), padding=0)
        sheet.alpha_composite(frame, (index * 8, 0))
    return indexed_png(sheet)


def remove_baked_checker(source: Image.Image) -> Image.Image:
    """Удалить светлую шахматную подложку, связанную с краями кадра.

    Flood fill важен: белые зубы и блики внутри тёмного контура остаются частью
    силуэта, хотя по цвету похожи на клетки фона.
    """
    rgba = source.convert("RGBA")
    if source.mode in ("RGBA", "LA") and rgba.getchannel("A").getextrema()[0] < 255:
        return rgba
    width, height = rgba.size
    pixels = rgba.load()
    outside = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def background(x: int, y: int) -> bool:
        red, green, blue, _ = pixels[x, y]
        return min(red, green, blue) >= 225 and max(red, green, blue) - min(red, green, blue) <= 14

    def seed(x: int, y: int) -> None:
        index = y * width + x
        if not outside[index] and background(x, y):
            outside[index] = 1
            queue.append((x, y))

    for x in range(width):
        seed(x, 0); seed(x, height - 1)
    for y in range(height):
        seed(0, y); seed(width - 1, y)
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= width or ny >= height:
                continue
            index = ny * width + nx
            if not outside[index] and background(nx, ny):
                outside[index] = 1
                queue.append((nx, ny))
    alpha = Image.new("L", rgba.size, 255)
    alpha.putdata([0 if value else 255 for value in outside])
    rgba.putalpha(alpha)
    return rgba


def remove_logo_checker(source: Image.Image) -> Image.Image:
    """Превратить светлую нарисованную шахматку логотипа в настоящую альфу.

    Тёмный металл и насыщенные огненные оттенки всегда остаются непрозрачными.
    Только нейтральные светлые пиксели считаются подложкой; промежуточные серые
    пиксели получают мягкую альфу, чтобы после очистки не осталось белого ореола.
    """
    rgba = source.convert("RGBA")
    # Новые листы приходят с настоящей прозрачностью; повторная очистка их RGB
    # превратила бы прозрачный чёрный фон в непрозрачный. Шахматку удаляем только
    # у старых полностью непрозрачных исходников.
    if rgba.getchannel("A").getextrema()[0] < 255:
        return rgba
    alpha = bytearray()
    for red, green, blue, _ in rgba.get_flattened_data():
        low, high = min(red, green, blue), max(red, green, blue)
        chroma = high - low
        if chroma > 18 or low <= 180:
            value = 255
        elif low >= 235:
            value = 0
        else:
            value = round((235 - low) / 55 * 255)
        alpha.append(value)
    rgba.putalpha(Image.frombytes("L", rgba.size, bytes(alpha)))
    return rgba


def compact_horizontal_sheet(source: Image.Image, count: int,
                             frame_size: tuple[int, int]) -> Image.Image:
    """Упаковать равноширинные кадры с общим масштабом и привязкой к низу."""
    frames: list[Image.Image] = []
    boxes: list[tuple[int, int, int, int]] = []
    for index in range(count):
        x0 = round(index * source.width / count)
        x1 = round((index + 1) * source.width / count)
        frame = source.crop((x0, 0, x1, source.height)).convert("RGBA")
        box = frame.getchannel("A").point(lambda value: 255 if value >= 16 else 0).getbbox()
        if not box:
            raise SystemExit(f"Пустой кадр меню: {index}")
        frames.append(frame)
        boxes.append(box)
    max_width = max(box[2] - box[0] for box in boxes)
    max_height = max(box[3] - box[1] for box in boxes)
    ratio = min((frame_size[0] - 4) / max_width, (frame_size[1] - 4) / max_height, 1)
    sheet = Image.new("RGBA", (frame_size[0] * count, frame_size[1]))
    for index, (frame, box) in enumerate(zip(frames, boxes)):
        crop = frame.crop(box)
        size = (max(1, round(crop.width * ratio)), max(1, round(crop.height * ratio)))
        if size != crop.size:
            crop = crop.resize(size, Image.Resampling.LANCZOS)
        x = index * frame_size[0] + (frame_size[0] - size[0]) // 2
        y = frame_size[1] - 2 - size[1]
        sheet.alpha_composite(crop, (x, y))
    return sheet


def split_horizontal_frames(source: Image.Image, count: int) -> list[Image.Image]:
    """Разрезать горизонтальный лист, сохранив исходные координаты кадров."""
    frames = []
    width = max(round((index + 1) * source.width / count) -
                round(index * source.width / count) for index in range(count))
    for index in range(count):
        x0 = round(index * source.width / count)
        x1 = round((index + 1) * source.width / count)
        frame = Image.new("RGBA", (width, source.height))
        frame.alpha_composite(source.crop((x0, 0, x1, source.height)).convert("RGBA"))
        frames.append(frame)
    return frames


def align_frames(frames: list[Image.Image], anchor_box) -> list[Image.Image]:
    """Совместить кадры по центру и низу неподвижной части изображения."""
    boxes = [anchor_box(frame) for frame in frames]
    if any(box is None for box in boxes):
        raise SystemExit("Не найдена неподвижная часть кадра меню")
    reference = boxes[0]
    reference_x = (reference[0] + reference[2]) / 2
    aligned = []
    for frame, box in zip(frames, boxes):
        x = round(reference_x - (box[0] + box[2]) / 2)
        y = reference[3] - box[3]
        placed = Image.new("RGBA", frame.size)
        placed.alpha_composite(frame, (x, y))
        aligned.append(placed)
    return aligned


def compact_stable_sheet(frames: list[Image.Image],
                         frame_size: tuple[int, int], padding: int = 2,
                         resample: Image.Resampling = Image.Resampling.LANCZOS,
                         stretch: bool = False) -> Image.Image:
    """Уменьшить все кадры через одну общую рамку и один transform.

    Разная высота пламени или подсветки больше не меняет масштаб и положение
    корпуса факела либо букв логотипа между соседними кадрами.
    """
    boxes = [frame.getchannel("A").point(
        lambda value: 255 if value >= 16 else 0).getbbox() for frame in frames]
    if any(box is None for box in boxes):
        raise SystemExit("Пустой стабилизированный кадр меню")
    shared = (min(box[0] for box in boxes), min(box[1] for box in boxes),
              max(box[2] for box in boxes), max(box[3] for box in boxes))
    width, height = shared[2] - shared[0], shared[3] - shared[1]
    if stretch:
        size = (frame_size[0] - padding * 2, frame_size[1] - padding * 2)
    else:
        ratio = min((frame_size[0] - padding * 2) / width,
                    (frame_size[1] - padding * 2) / height, 1)
        size = (max(1, round(width * ratio)), max(1, round(height * ratio)))
    x = (frame_size[0] - size[0]) // 2
    y = frame_size[1] - padding - size[1]
    sheet = Image.new("RGBA", (frame_size[0] * len(frames), frame_size[1]))
    for index, frame in enumerate(frames):
        crop = frame.crop(shared)
        if crop.size != size:
            crop = crop.resize(size, resample)
        sheet.alpha_composite(crop, (index * frame_size[0] + x, y))
    return sheet


def puddle_sprite_sheet(path: Path, frame_size: int) -> bytes:
    """Упаковать четыре кадра наземного эффекта с общей нижней привязкой.

    Исходники из handoff имеют мягкую генеративную альфу. До уменьшения она
    переводится в один прозрачный/непрозрачный слой: так не остаётся случайной
    полупрозрачной грязи и широкого свечения у часто повторяемых следов.
    """
    frames = split_horizontal_frames(Image.open(path).convert("RGBA"), 4)
    cleaned = []
    for frame in frames:
        alpha = frame.getchannel("A").point(lambda value: 255 if value >= 64 else 0)
        frame.putalpha(alpha)
        cleaned.append(frame)
    sheet = compact_stable_sheet(cleaned, (frame_size, frame_size), padding=1,
                                 resample=Image.Resampling.NEAREST)
    return indexed_png(sheet)


def stable_logo_frames(source: Image.Image) -> list[Image.Image]:
    """Оставить геометрию вывески неподвижной, перенеся лишь свет кадров."""
    frames = split_horizontal_frames(source, 8)
    alpha_box = lambda frame: frame.getchannel("A").point(
        lambda value: 255 if value >= 16 else 0).getbbox()
    frames = align_frames(frames, alpha_box)
    master = frames[0]
    master_blur = master.filter(ImageFilter.GaussianBlur(radius=10)).convert("RGB")
    master_pixels = list(master.get_flattened_data())
    master_light = list(master_blur.get_flattened_data())
    stable = []
    for frame in frames:
        source_light = list(frame.filter(ImageFilter.GaussianBlur(
            radius=10)).convert("RGB").get_flattened_data())
        pixels = []
        for base, dark, lit in zip(master_pixels, master_light, source_light):
            red, green, blue, alpha = base
            if alpha == 0:
                pixels.append((0, 0, 0, 0))
                continue
            channels = []
            for value, base_light, frame_light in zip((red, green, blue), dark, lit):
                ratio = max(0.55, min(2.35, (frame_light + 12) / (base_light + 12)))
                channels.append(max(0, min(255, round(value * ratio))))
            pixels.append((*channels, alpha))
        result = Image.new("RGBA", master.size)
        result.putdata(pixels)
        stable.append(result)
    return stable


def stable_torch_frames(source: Image.Image) -> list[Image.Image]:
    """Повторить один корпус факела и анимировать только пламя и его жар."""
    frames = split_horizontal_frames(source, 8)
    lower_start = round(source.height * 0.55)

    def body_box(frame: Image.Image):
        alpha = frame.getchannel("A").point(lambda value: 255 if value >= 16 else 0)
        mask = Image.new("L", frame.size)
        mask.paste(alpha.crop((0, lower_start, frame.width, frame.height)),
                   (0, lower_start))
        return mask.getbbox()

    frames = align_frames(frames, body_box)
    flame_top = round(source.height * 0.30)
    flame_bottom = round(source.height * 0.56)

    def fire_mask(frame: Image.Image) -> Image.Image:
        mask = Image.new("L", frame.size)
        source_pixels = frame.load()
        target_pixels = mask.load()
        for y in range(frame.height):
            for x in range(frame.width):
                red, green, blue, alpha = source_pixels[x, y]
                warm = (y < flame_bottom and red >= 45 and
                        red > green * 1.10 and green > blue * 1.04)
                if alpha >= 16 and (y < flame_top or warm):
                    target_pixels[x, y] = alpha
        return mask

    master = frames[0]
    master_fire = fire_mask(master)
    body = master.copy()
    body.putalpha(ImageChops.subtract(master.getchannel("A"), master_fire))
    stable = []
    for frame in frames:
        result = body.copy()
        flame = Image.new("RGBA", frame.size)
        flame.paste(frame, mask=fire_mask(frame))
        result.alpha_composite(flame)
        stable.append(result)
    return stable


def menu_logo_source(path: Path) -> Image.Image:
    """Принять прозрачный, светлый checkerboard или чёрный фон логотипа."""
    source = Image.open(path).convert("RGBA")
    if source.getchannel("A").getextrema()[0] < 255:
        return source
    corners = (source.getpixel((0, 0)), source.getpixel((source.width - 1, 0)),
               source.getpixel((0, source.height - 1)),
               source.getpixel((source.width - 1, source.height - 1)))
    if max(max(pixel[:3]) for pixel in corners) < 48:
        return remove_dark_background(source)
    return remove_logo_checker(source)


def menu_logo_sheet(path: Path) -> bytes:
    source = menu_logo_source(path)
    # Этот центральный арт намеренно крупнее остальных runtime-спрайтов:
    # 512×144 на кадр и 63 цвета сохраняют мелкий металл и огненные блики.
    sheet = compact_stable_sheet(stable_logo_frames(source), (512, 144),
                                 stretch=True)
    return indexed_png(sheet, opaque_colors=63, transparent_index=63, bits=8)


def menu_torch_sheet(path: Path) -> bytes:
    source = Image.open(path).convert("RGBA")
    return indexed_png(compact_stable_sheet(stable_torch_frames(source), (72, 192)))


def menu_constellation_star_sheet(path: Path) -> bytes:
    """Восемь мерцающих звёзд из широкого master-листа → кадры 32×32.

    Каждый кадр берётся из фиксированного квадрата вокруг центра исходной
    ячейки: так сохраняется заложенное автором изменение размера при мерцании.
    """
    source = Image.open(path).convert("RGBA")
    sheet = Image.new("RGBA", (256, 32))
    center_y = source.height / 2
    for index in range(8):
        x0 = round(index * source.width / 8)
        x1 = round((index + 1) * source.width / 8)
        side = x1 - x0
        y0 = round(center_y - side / 2)
        frame = source.crop((x0, y0, x1, y0 + side))
        frame = frame.resize((32, 32), Image.Resampling.NEAREST)
        sheet.alpha_composite(frame, (index * 32, 0))
    return indexed_png(sheet)


def elite_variant_sheet(path: Path) -> bytes:
    """Четыре кадра элитной разновидности → компактный лист 192×48."""
    source = remove_baked_checker(Image.open(path))
    sheet = Image.new("RGBA", (192, 48))
    for index in range(4):
        x0 = round(index * source.width / 4)
        x1 = round((index + 1) * source.width / 4)
        frame = fit_frame(source.crop((x0, 0, x1, source.height)), (48, 48), padding=1)
        sheet.alpha_composite(frame, (index * 48, 0))
    return indexed_png(sheet)


def install_object_payloads(html: str, object_name: str, payload: dict[str, str]) -> str:
    """Добавить или заменить data URI внутри автономного JS-объекта."""
    matches = list(re.finditer(
        rf"const {re.escape(object_name)} = \{{.*?\n\}};", html, flags=re.S))
    if len(matches) != 1:
        raise SystemExit(f"Объект {object_name}: ожидался один якорь, найдено {len(matches)}")
    match = matches[0]
    body = match.group(0)
    for key, value in payload.items():
        entry = f"  {key}:'data:image/png;base64,{value}',"
        pattern = rf"^\s*{re.escape(key)}:'data:image/png;base64,[^']+',\s*$"
        key_matches = list(re.finditer(pattern, body, flags=re.M))
        if len(key_matches) == 1:
            body = re.sub(pattern, entry, body, count=1, flags=re.M)
        elif len(key_matches) > 1:
            raise SystemExit(f"{object_name}.{key}: найдено несколько ключей")
        else:
            body = body[:-3] + "\n" + entry + "\n};"
    return html[:match.start()] + body + html[match.end():]


def optimize_embedded_frame_family(html: str, object_name: str,
                                   keys: tuple[str, ...], size: tuple[int, int]) -> tuple[str, dict[str, int]]:
    """Переупаковать уже встроенные рамки; повторный запуск не ухудшает готовую палитру."""
    matches = list(re.finditer(
        rf"const {re.escape(object_name)} = \{{.*?\n\}};", html, flags=re.S))
    if len(matches) != 1:
        raise SystemExit(f"Объект {object_name}: ожидался один якорь, найдено {len(matches)}")
    body = matches[0].group(0)
    payload: dict[str, str] = {}
    source_bytes = 0
    optimized_bytes = 0
    for key in keys:
        pattern = rf"^\s*{re.escape(key)}:'data:image/png;base64,([^']+)',\s*$"
        key_matches = list(re.finditer(pattern, body, flags=re.M))
        if len(key_matches) != 1:
            raise SystemExit(
                f"{object_name}.{key}: ожидался один встроенный PNG, найдено {len(key_matches)}")
        data = base64.b64decode(key_matches[0].group(1), validate=True)
        image = Image.open(io.BytesIO(data))
        if image.size != size:
            raise SystemExit(f"{object_name}.{key}: ожидался размер {size}, получен {image.size}")
        colors = image.getcolors(maxcolors=256) if image.mode == "P" else None
        optimized = data if colors and len(colors) <= FRAME_PALETTE_COLORS else indexed_rgba_png(image)
        payload[key] = base64.b64encode(optimized).decode("ascii")
        source_bytes += len(data)
        optimized_bytes += len(optimized)
    return install_object_payloads(html, object_name, payload), {
        "sourceBytes": source_bytes,
        "optimizedBytes": optimized_bytes,
    }


def constellation_sheets(path: Path) -> dict[str, bytes]:
    """Два ряда по четыре кадра: убрать тёмный фон и собрать 4×48 для UI."""
    source = Image.open(path).convert("RGBA")
    if source.size != (1536, 1024):
        raise SystemExit("Лист созвездий должен быть 1536×1024")
    result = {}
    for key, row in (("elite", 0), ("boss", 1)):
        sheet = Image.new("RGBA", (192, 48))
        for index in range(4):
            cell = source.crop((index * 384, row * 512, (index + 1) * 384, (row + 1) * 512))
            red, green, blue, _ = cell.split()
            luminance = ImageChops.lighter(ImageChops.lighter(red, green), blue)
            mask = luminance.point(lambda value: 255 if value >= 105 else 0).filter(ImageFilter.MaxFilter(17))
            box = mask.getbbox()
            if not box:
                raise SystemExit(f"Пустой кадр созвездия: {key} {index}")
            crop, crop_mask = cell.crop(box), mask.crop(box)
            crop.putalpha(crop_mask)
            ratio = min(46 / crop.width, 46 / crop.height)
            size = (max(1, round(crop.width * ratio)), max(1, round(crop.height * ratio)))
            crop = crop.resize(size, Image.Resampling.NEAREST)
            frame = Image.new("RGBA", (48, 48))
            frame.alpha_composite(crop, ((48 - size[0]) // 2, 47 - size[1]))
            sheet.alpha_composite(frame, (index * 48, 0))
        result[key] = indexed_png(sheet)
    return result


def uri_bytes(html: str, key: str) -> bytes:
    match = re.search(rf"{re.escape(key)}\s*[:=]\s*'data:image/png;base64,([^']+)'", html)
    if not match:
        raise SystemExit(f"Не найден PNG-ключ {key}")
    return base64.b64decode(match.group(1))


def replace_uri(html: str, key: str, png: bytes) -> str:
    pattern = rf"({re.escape(key)}:'data:image/png;base64,)[^']+(')"
    replacement = rf"\g<1>{base64.b64encode(png).decode('ascii')}\2"
    updated, count = re.subn(pattern, replacement, html)
    if count != 1:
        raise SystemExit(f"Ключ {key}: ожидалась одна замена, получено {count}")
    return updated


def exact_replace(html: str, old: str, new: str, note: str) -> str:
    count = html.count(old)
    if count != 1:
        raise SystemExit(f"{note}: якорь встретился {count} раз")
    return html.replace(old, new)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archer", type=Path)
    parser.add_argument("--mage", type=Path)
    parser.add_argument("--warrior", type=Path)
    parser.add_argument("--necromancer", type=Path)
    parser.add_argument("--shooter", type=Path)
    parser.add_argument("--shooter-projectile", type=Path)
    parser.add_argument("--archer-projectile", type=Path)
    parser.add_argument("--mage-projectile", type=Path)
    parser.add_argument("--plague-slime-projectile", type=Path)
    parser.add_argument("--emerald-orb-projectile", type=Path)
    parser.add_argument("--greed-spear-projectile", type=Path)
    parser.add_argument("--executioner-axe-projectile", type=Path)
    parser.add_argument("--minotaur-spear-projectile", type=Path)
    parser.add_argument("--seraph-holy-spear", type=Path)
    parser.add_argument("--demon-queen-blob", type=Path)
    parser.add_argument("--matriarch-plague-projectile", type=Path)
    parser.add_argument("--void-ground-rift", type=Path)
    parser.add_argument("--arcane-mine", type=Path)
    parser.add_argument("--arcane-mine-explosion", type=Path)
    parser.add_argument("--necro-skeleton", type=Path)
    parser.add_argument("--necro-hunter", type=Path)
    parser.add_argument("--necro-mage", type=Path)
    parser.add_argument("--necro-blood-golem", type=Path)
    parser.add_argument("--necro-bone-golem", type=Path)
    parser.add_argument("--mage-explosion-normal", type=Path)
    parser.add_argument("--mage-explosion-remote", type=Path)
    parser.add_argument("--mage-explosion-mini", type=Path)
    parser.add_argument("--mage-residual-arcana", type=Path)
    parser.add_argument("--mage-elemental-explosion", type=Path)
    parser.add_argument("--mage-blast-heart", type=Path)
    parser.add_argument("--vampire-boss", type=Path)
    parser.add_argument("--void-wrath-boss", type=Path)
    parser.add_argument("--minotaur-boss", type=Path)
    parser.add_argument("--seraph-boss", type=Path)
    parser.add_argument("--matriarch-boss", type=Path)
    parser.add_argument("--demon-queen-boss", type=Path)
    parser.add_argument("--constellation-sheet", type=Path)
    parser.add_argument("--ice-wolf", type=Path)
    parser.add_argument("--toxic-runner", type=Path)
    parser.add_argument("--cursed-rogue", type=Path)
    parser.add_argument("--skeleton-warrior", type=Path)
    parser.add_argument("--blight-grunt", type=Path)
    parser.add_argument("--bone-gargoyle", type=Path)
    parser.add_argument("--pyromancer-cultist", type=Path)
    parser.add_argument("--beholder-slave", type=Path)
    parser.add_argument("--skeleton-crossbow", type=Path)
    parser.add_argument("--forgotten-guard", type=Path)
    parser.add_argument("--abyssal-warden", type=Path)
    parser.add_argument("--acid-carrier", type=Path)
    parser.add_argument("--menu-logo", type=Path)
    parser.add_argument("--menu-torch", type=Path)
    parser.add_argument("--menu-constellation-star", type=Path)
    parser.add_argument("--pickup-xp", type=Path)
    parser.add_argument("--pickup-gold", type=Path)
    parser.add_argument("--book-fire", type=Path)
    parser.add_argument("--book-cold", type=Path)
    parser.add_argument("--book-lightning", type=Path)
    parser.add_argument("--book-poison", type=Path)
    parser.add_argument("--book-bleed", type=Path)
    parser.add_argument("--book-xp", type=Path)
    parser.add_argument("--book-monster", type=Path)
    parser.add_argument("--build-loot-sprites", action="store_true",
                        help="записать компактные листы опыта, золота и семи книг в outputs")
    parser.add_argument("--install-loot-sprites", action="store_true",
                        help="собрать и встроить девять листов наземного лута в HTML")
    parser.add_argument("--puddle-sprite-dir", type=Path,
                        help="word/media с восемью четырёхкадровыми наземными эффектами")
    parser.add_argument("--build-puddle-sprites", action="store_true",
                        help="собрать восемь компактных листов луж и следов в outputs")
    parser.add_argument("--install-puddle-sprites", action="store_true",
                        help="проверить SHA-256 и встроить восемь листов луж и следов в HTML")
    parser.add_argument("--rare-item-dir", type=Path,
                        help="каталог word/media с image1.png–image16.png из DOCX")
    parser.add_argument("--build-rare-item-sprites", action="store_true",
                        help="записать 16 статичных иконок редких предметов 24×24 в outputs")
    parser.add_argument("--install-rare-item-sprites", action="store_true",
                        help="проверить SHA-256, упаковать и встроить 16 редких предметов в HTML")
    parser.add_argument("--epic-item-dir", type=Path,
                        help="каталог с пятью исходными PNG новых эпических предметов")
    parser.add_argument("--build-epic-item-icons", action="store_true",
                        help="записать пять статичных иконок эпических предметов 24×24 в outputs")
    parser.add_argument("--install-epic-item-icons", action="store_true",
                        help="проверить SHA-256 и встроить пять эпических предметов в HTML")
    parser.add_argument("--legendary-item-dir", type=Path,
                        help="каталог с семью исходными PNG легендарных предметов")
    parser.add_argument("--build-legendary-item-icons", action="store_true",
                        help="записать семь статичных иконок легендарных предметов 24×24 в outputs")
    parser.add_argument("--install-legendary-item-icons", action="store_true",
                        help="проверить SHA-256 и встроить семь легендарных предметов в HTML")
    parser.add_argument("--amulet-icon-dir", type=Path,
                        help="каталог word/media с Master-иконками image1,3,…,17 из DOCX")
    parser.add_argument("--build-amulet-icons", action="store_true",
                        help="записать девять статичных Master-иконок амулетов 24×24 в outputs")
    parser.add_argument("--install-amulet-icons", action="store_true",
                        help="проверить SHA-256 и встроить девять Master-иконок амулетов в HTML")
    parser.add_argument("--glove-icon-dir", type=Path,
                        help="каталог word/media с восемью иконками перчаток image1.png–image8.png из DOCX")
    parser.add_argument("--build-glove-icons", action="store_true",
                        help="записать восемь статичных иконок перчаток 24×24 в outputs")
    parser.add_argument("--install-glove-icons", action="store_true",
                        help="проверить SHA-256 и встроить восемь иконок перчаток в HTML")
    parser.add_argument("--boot-icon-dir", type=Path,
                        help="каталог word/media с шестью иконками ботинок image1.png–image6.png из DOCX")
    parser.add_argument("--build-boot-icons", action="store_true",
                        help="записать шесть статичных иконок ботинок 24×24 в outputs")
    parser.add_argument("--install-boot-icons", action="store_true",
                        help="проверить SHA-256 и встроить шесть иконок ботинок в HTML")
    parser.add_argument("--ring-icon-dir", type=Path,
                        help="каталог word/media с девятью иконками колец image1.png–image9.png из DOCX")
    parser.add_argument("--build-ring-icons", action="store_true",
                        help="записать девять статичных иконок колец 24×24 в outputs")
    parser.add_argument("--install-ring-icons", action="store_true",
                        help="проверить SHA-256 и встроить девять иконок колец в HTML")
    parser.add_argument("--relic-icon-dir", type=Path,
                        help="каталог word/media с семью иконками реликвий image1.png–image7.png из DOCX")
    parser.add_argument("--build-relic-icons", action="store_true",
                        help="записать семь статичных иконок реликвий 24×24 в outputs")
    parser.add_argument("--install-relic-icons", action="store_true",
                        help="проверить SHA-256 и встроить семь иконок реликвий в HTML")
    parser.add_argument("--enemy-status-icons", type=Path,
                        help="master-лист 4×3 с иконками состояний противников")
    parser.add_argument("--build-enemy-status-icons", action="store_true",
                        help="вырезать семь элементальных состояний в лист 112×16")
    parser.add_argument("--install-enemy-status-icons", action="store_true",
                        help="собрать и встроить лист элементальных состояний в HTML")
    parser.add_argument("--floor-portal", type=Path,
                        help="нативный RGBA-лист портала 1024×128: восемь кадров по 128×128")
    parser.add_argument("--build-floor-portal", action="store_true",
                        help="проверить и без перекодирования скопировать восьмикадровый портал в outputs")
    parser.add_argument("--install-floor-portal", action="store_true",
                        help="проверить и без перекодирования встроить анимацию портала завершения этажа")
    parser.add_argument("--totem-sprite-dir", type=Path,
                        help="word/media с 16 Master-спрайтами четырёх существующих тотемов")
    parser.add_argument("--lightning-totem-sprite-dir", type=Path,
                        help="word/media с четырьмя Master-спрайтами тотема молнии")
    parser.add_argument("--build-totem-sprites", action="store_true",
                        help="собрать 20 rank-specific иконок тотемов 24×24 в outputs")
    parser.add_argument("--install-totem-sprites", action="store_true",
                        help="проверить SHA-256 и встроить пять тотемов по четыре ранга")
    parser.add_argument("--build-menu-assets", action="store_true",
                        help="записать переданные прозрачные листы логотипа и/или факела в outputs")
    parser.add_argument("--install-menu-assets", action="store_true",
                        help="собрать переданные листы меню и встроить их data URI в автономный HTML")
    parser.add_argument("--class-icon-docx", type=Path,
                        help="DOCX handoff с четырьмя 10-кадровыми эмблемами классов")
    parser.add_argument("--install-class-icon-sheets", action="store_true",
                        help="проверить, уменьшить и встроить эмблемы классов в главное меню")
    parser.add_argument("--class-frame-docx", type=Path,
                        help="DOCX handoff с оригинальными V2-рамками классов")
    parser.add_argument("--install-class-frames", action="store_true",
                        help="проверить и встроить четыре V2-рамки классов в автономный HTML")
    parser.add_argument("--skill-card-frame-docx", type=Path,
                        help="DOCX handoff с пятью цветными рамками карточек навыков")
    parser.add_argument("--install-skill-card-frames", action="store_true",
                        help="проверить и без перекодирования встроить пять 9-slice рамок навыков")
    parser.add_argument("--subclass-frame-asset-dir", type=Path,
                        help="каталог с 12 готовыми рамками подклассов 320×400")
    parser.add_argument("--install-subclass-frames", action="store_true",
                        help="проверить и встроить двенадцать рамок подклассов в автономный HTML")
    parser.add_argument("--subclass-hero-asset-dir", type=Path,
                        help="каталог с 12 детальными восьмикадровыми листами подклассов 288×36")
    parser.add_argument("--install-subclass-hero-sprites", action="store_true",
                        help="без ресэмплинга проверить и встроить 12 моделей подклассов в HTML")
    parser.add_argument("--blood-asset-dir", type=Path,
                        help="каталог assets из handoff системы крови")
    parser.add_argument("--install-blood-assets", action="store_true",
                        help="проверить и без ресэмплинга встроить три листа крови в HTML")
    parser.add_argument("--corpse-docx", type=Path,
                        help="DOCX handoff с 30 отдельными прозрачными спрайтами трупов")
    parser.add_argument("--install-corpse-sprites", action="store_true",
                        help="проверить и без ресэмплинга встроить 30 трупов в HTML")
    parser.add_argument("--corpse-puddle-asset-dir", type=Path,
                        help="каталог с оптимизированным атласом шести кровавых луж")
    parser.add_argument("--install-corpse-puddles", action="store_true",
                        help="проверить и встроить атлас луж 6×64 в HTML")
    parser.add_argument("--optimize-embedded-frames", action="store_true",
                        help="переупаковать уже встроенные рамки в индексированные PNG на 128 цветов")
    parser.add_argument("--shop-icon-atlas", type=Path,
                        help="сгенерированный прозрачный атлас 5×4 иконок магазина")
    parser.add_argument("--install-shop-icon-atlas", action="store_true",
                        help="сжать и встроить атлас иконок магазина в автономный HTML")
    parser.add_argument("--menu-background", type=Path,
                        help="исходный PNG 1672×941 с фоном главного меню")
    parser.add_argument("--install-menu-background", action="store_true",
                        help="сжать фон в WebP quality 35 и встроить его в CSS автономного HTML")
    parser.add_argument("--constellation-observatory", type=Path,
                        help="сгенерированный PNG 1536x1024 для нового меню созвездий")
    parser.add_argument("--install-constellation-observatory", action="store_true",
                        help="уменьшить, проверить и встроить фон астральной обсерватории")
    parser.add_argument("--menu-music", type=Path,
                        help="готовая OGG/Vorbis музыка главного меню")
    parser.add_argument("--install-menu-music", action="store_true",
                        help="проверить и встроить OGG главного меню в автономный HTML")
    parser.add_argument("--confirm-sound", type=Path,
                        help="готовый короткий OGG/Opus звук подтверждения")
    parser.add_argument("--install-confirm-sound", action="store_true",
                        help="проверить и встроить Opus-подтверждение в автономный HTML")
    parser.add_argument("--hover-sound", type=Path,
                        help="готовый короткий OGG/Opus звук наведения по меню")
    parser.add_argument("--install-hover-sound", action="store_true",
                        help="проверить и встроить Hover UI в автономный HTML")
    parser.add_argument("--archer-shot-sounds", type=Path, nargs=4,
                        help="четыре OGG/Vorbis вариации выстрела Лучника")
    parser.add_argument("--install-archer-shot-sounds", action="store_true",
                        help="проверить и встроить четыре выстрела Лучника в автономный HTML")
    parser.add_argument("--warrior-attack-sounds", type=Path, nargs=4,
                        help="четыре OGG/Vorbis вариации атаки Воина")
    parser.add_argument("--install-warrior-attack-sounds", action="store_true",
                        help="проверить и встроить четыре атаки Воина в автономный HTML")
    parser.add_argument("--mage-attack-sounds", type=Path, nargs=4,
                        help="четыре OGG/Vorbis вариации атаки Мага")
    parser.add_argument("--install-mage-attack-sounds", action="store_true",
                        help="проверить и встроить четыре атаки Мага в автономный HTML")
    parser.add_argument("--emit-shooter-base64", action="store_true",
                        help="вывести JSON двух оптимизированных data payload без изменения HTML")
    parser.add_argument("--emit-player-projectile-base64", action="store_true",
                        help="вывести JSON стрелы и сферы без изменения HTML")
    parser.add_argument("--build-plague-slime-projectile", action="store_true",
                        help="записать четырёхкадровый сгусток Чумной мерзости в outputs")
    parser.add_argument("--install-plague-slime-projectile", action="store_true",
                        help="упаковать и встроить сгусток Чумной мерзости в HTML")
    parser.add_argument("--build-emerald-orb-projectile", action="store_true",
                        help="записать четырёхкадровую Изумрудную сферу в outputs")
    parser.add_argument("--install-emerald-orb-projectile", action="store_true",
                        help="упаковать и встроить Изумрудную сферу Лича в HTML")
    parser.add_argument("--build-greed-spear-projectile", action="store_true",
                        help="записать четырёхкадровое Копьё жадности в outputs")
    parser.add_argument("--install-greed-spear-projectile", action="store_true",
                        help="упаковать и встроить Копьё жадности Алчного громилы в HTML")
    parser.add_argument("--build-executioner-axe-projectile", action="store_true",
                        help="записать восьмикадровый вращающийся топор в outputs")
    parser.add_argument("--install-executioner-axe-projectile", action="store_true",
                        help="упаковать и встроить топор Короля палачей в HTML")
    parser.add_argument("--build-minotaur-spear-projectile", action="store_true",
                        help="записать четырёхкадровое Копьё Минотавра в outputs")
    parser.add_argument("--install-minotaur-spear-projectile", action="store_true",
                        help="упаковать и встроить копьё Ужасающего Минотавра в HTML")
    parser.add_argument("--build-seraph-holy-spear", action="store_true",
                        help="записать четырёхкадровое Святое Копьё в outputs")
    parser.add_argument("--install-seraph-holy-spear", action="store_true",
                        help="упаковать и встроить Святое Копьё Падшего Серафима в HTML")
    parser.add_argument("--build-demon-queen-blob", action="store_true",
                        help="записать четырёхкадровый Демонический сгусток в outputs")
    parser.add_argument("--install-demon-queen-blob", action="store_true",
                        help="упаковать и встроить сгусток Демонической Королевы в HTML")
    parser.add_argument("--build-matriarch-plague-projectile", action="store_true",
                        help="записать четырёхкадровый Чумной снаряд в outputs")
    parser.add_argument("--install-matriarch-plague-projectile", action="store_true",
                        help="упаковать и встроить Чумной снаряд Матриархии в HTML")
    parser.add_argument("--build-void-ground-rift", action="store_true",
                        help="записать четырёхкадровый наземный Разлом Пустоты в outputs")
    parser.add_argument("--install-void-ground-rift", action="store_true",
                        help="упаковать и встроить разломы Гнева Пустоты в HTML")
    parser.add_argument("--build-arcane-mine-assets", action="store_true",
                        help="записать компактные кадры Арканной мины в outputs")
    parser.add_argument("--build-minion-assets", action="store_true",
                        help="записать пять компактных листов свиты в outputs")
    parser.add_argument("--install-minion-assets", action="store_true",
                        help="упаковать и встроить пять листов свиты в автономный HTML")
    parser.add_argument("--build-mage-ability-assets", action="store_true",
                        help="записать шесть компактных листов взрывов Мага в outputs")
    parser.add_argument("--install-mage-ability-assets", action="store_true",
                        help="упаковать и встроить шесть листов взрывов Мага в HTML")
    parser.add_argument("--emit-new-boss-base64", action="store_true",
                        help="вывести JSON шести новых листов боссов без изменения HTML")
    parser.add_argument("--emit-constellation-base64", action="store_true",
                        help="вывести JSON листов элиты и босса для созвездий")
    parser.add_argument("--emit-elite-variant-base64", action="store_true",
                        help="вывести JSON шести оптимизированных разновидностей элиты")
    parser.add_argument("--install-elite-variants", action="store_true",
                        help="упаковать шесть разновидностей элиты прямо в автономный HTML")
    parser.add_argument("--emit-elite-ranged-tank-base64", action="store_true",
                        help="вывести JSON шести оптимизированных ranged/tank разновидностей элиты")
    parser.add_argument("--install-elite-ranged-tank", action="store_true",
                        help="добавить шесть ranged/tank разновидностей элиты в автономный HTML")
    args = parser.parse_args()

    if args.install_skill_card_frames:
        if not args.skill_card_frame_docx or not args.skill_card_frame_docx.is_file():
            parser.error("рамки навыков требуют существующий --skill-card-frame-docx")
        payload: dict[str, str] = {}
        source_bytes = 0
        with zipfile.ZipFile(args.skill_card_frame_docx) as archive:
            for rarity, (member, expected_hash) in SKILL_CARD_FRAME_SOURCES.items():
                data = archive.read(member)
                actual_hash = hashlib.sha256(data).hexdigest()
                if actual_hash != expected_hash:
                    raise SystemExit(
                        f"рамка навыка {rarity}: SHA-256 {actual_hash}, ожидался {expected_hash}")
                image = Image.open(io.BytesIO(data))
                if image.size != (304, 194) or image.mode != "RGBA":
                    raise SystemExit(
                        f"рамка навыка {rarity}: ожидался RGBA 304x194, получен {image.mode} {image.size}")
                if image.getchannel("A").getextrema()[0] != 0:
                    raise SystemExit(f"рамка навыка {rarity}: отсутствует прозрачный центр/фон")
                payload[rarity] = base64.b64encode(data).decode("ascii")
                source_bytes += len(data)
        html = HTML.read_text(encoding="utf-8")
        if "const SKILL_CARD_FRAME_DATA = {" not in html:
            anchor = "const CLASS_FRAME_DATA = {"
            if anchor not in html:
                raise SystemExit("не найден якорь CLASS_FRAME_DATA для рамок навыков")
            html = html.replace(anchor, "const SKILL_CARD_FRAME_DATA = {\n};\n\n" + anchor, 1)
        html = install_object_payloads(html, "SKILL_CARD_FRAME_DATA", payload)
        HTML.write_text(html.rstrip("\n") + "\n", encoding="utf-8", newline="\n")
        print(json.dumps({
            "installed": sorted(payload),
            "sourceBytes": source_bytes,
            "runtimeBytes": source_bytes,
            "resampled": False,
            "nineSlice": True,
            "target": str(HTML),
        }, ensure_ascii=False))
        return

    if args.install_class_icon_sheets:
        if not args.class_icon_docx or not args.class_icon_docx.is_file():
            parser.error("эмблемы классов требуют существующий --class-icon-docx")
        payload: dict[str, str] = {}
        source_bytes = 0
        optimized_bytes = 0
        with zipfile.ZipFile(args.class_icon_docx) as archive:
            for class_name, (member, expected_hash) in CLASS_ICON_SHEET_SOURCES.items():
                data = archive.read(member)
                actual_hash = hashlib.sha256(data).hexdigest()
                if actual_hash != expected_hash:
                    raise SystemExit(
                        f"эмблема {class_name}: SHA-256 {actual_hash}, ожидался {expected_hash}")
                image = Image.open(io.BytesIO(data))
                if image.size != (2560, 256) or image.mode != "RGBA":
                    raise SystemExit(
                        f"эмблема {class_name}: ожидался RGBA 2560×256, получен {image.mode} {image.size}")
                optimized = class_icon_sheet(image)
                payload[class_name] = base64.b64encode(optimized).decode("ascii")
                source_bytes += len(data)
                optimized_bytes += len(optimized)
        html = HTML.read_text(encoding="utf-8")
        if "const CLASS_ICON_SHEET_DATA = {" not in html:
            anchor = "const CLASS_FRAME_DATA = {"
            if anchor not in html:
                raise SystemExit("не найден якорь CLASS_FRAME_DATA для эмблем классов")
            html = html.replace(anchor, "const CLASS_ICON_SHEET_DATA = {\n};\n\n" + anchor, 1)
        html = install_object_payloads(html, "CLASS_ICON_SHEET_DATA", payload)
        HTML.write_text(html.rstrip("\n") + "\n", encoding="utf-8", newline="\n")
        print(json.dumps({
            "installed": sorted(payload),
            "sourceBytes": source_bytes,
            "optimizedBytes": optimized_bytes,
            "decodedBytes": len(payload) * 1280 * 128 * 4,
            "paletteColors": FRAME_PALETTE_COLORS,
            "target": str(HTML),
        }, ensure_ascii=False))
        return

    if args.optimize_embedded_frames:
        html = HTML.read_text(encoding="utf-8")
        html, class_stats = optimize_embedded_frame_family(
            html, "CLASS_FRAME_DATA", tuple(CLASS_FRAME_SOURCES), (280, 390))
        html, subclass_stats = optimize_embedded_frame_family(
            html, "SUBCLASS_FRAME_DATA", tuple(SUBCLASS_FRAME_SOURCES), (270, 304))
        HTML.write_text(html.rstrip("\n") + "\n", encoding="utf-8", newline="\n")
        print(json.dumps({
            "paletteColors": FRAME_PALETTE_COLORS,
            "classFrames": class_stats,
            "subclassFrames": subclass_stats,
            "target": str(HTML),
        }, ensure_ascii=False))
        return

    if args.install_class_frames:
        if not args.class_frame_docx or not args.class_frame_docx.is_file():
            parser.error("рамки классов требуют существующий --class-frame-docx")
        payload: dict[str, str] = {}
        source_bytes = 0
        optimized_bytes = 0
        with zipfile.ZipFile(args.class_frame_docx) as archive:
            for class_name, (member, expected_hash) in CLASS_FRAME_SOURCES.items():
                data = archive.read(member)
                actual_hash = hashlib.sha256(data).hexdigest()
                if actual_hash != expected_hash:
                    raise SystemExit(
                        f"рамка {class_name}: SHA-256 {actual_hash}, ожидался {expected_hash}")
                image = Image.open(io.BytesIO(data))
                if image.size != (280, 390) or image.mode != "RGBA":
                    raise SystemExit(
                        f"рамка {class_name}: ожидался RGBA 280×390, получен {image.mode} {image.size}")
                optimized = indexed_rgba_png(image)
                payload[class_name] = base64.b64encode(optimized).decode("ascii")
                source_bytes += len(data)
                optimized_bytes += len(optimized)
        html = HTML.read_text(encoding="utf-8")
        if "const CLASS_FRAME_DATA = {" not in html:
            anchor = "const HERO_SPRITE_DATA = {"
            if anchor not in html:
                raise SystemExit("не найден якорь HERO_SPRITE_DATA для рамок классов")
            html = html.replace(anchor, "const CLASS_FRAME_DATA = {\n};\n" + anchor, 1)
        html = install_object_payloads(html, "CLASS_FRAME_DATA", payload)
        HTML.write_text(html.rstrip("\n") + "\n", encoding="utf-8")
        print(json.dumps({
            "installed": sorted(payload),
            "sourceBytes": source_bytes,
            "optimizedBytes": optimized_bytes,
            "paletteColors": FRAME_PALETTE_COLORS,
            "target": str(HTML),
        }, ensure_ascii=False))
        return

    if args.install_corpse_sprites:
        if not args.corpse_docx or not args.corpse_docx.is_file():
            parser.error("трупы требуют существующий --corpse-docx")
        payload: dict[str, str] = {}
        source_bytes = 0
        with zipfile.ZipFile(args.corpse_docx) as archive:
            for key, (member, expected_hash, expected_size) in CORPSE_SPRITE_SOURCES.items():
                data = archive.read(member)
                actual_hash = hashlib.sha256(data).hexdigest()
                if actual_hash != expected_hash:
                    raise SystemExit(
                        f"труп {key}: SHA-256 {actual_hash}, ожидался {expected_hash}")
                image = Image.open(io.BytesIO(data))
                if image.size != expected_size or image.mode != "RGBA":
                    raise SystemExit(
                        f"труп {key}: ожидался RGBA {expected_size}, получен {image.mode} {image.size}")
                if image.getchannel("A").getextrema()[0] != 0:
                    raise SystemExit(f"труп {key}: отсутствует прозрачный фон")
                runtime_data = corpse_half_size_png(image)
                runtime_image = Image.open(io.BytesIO(runtime_data))
                expected_runtime_size = (expected_size[0] // 2, (expected_size[1] + 1) // 2)
                if runtime_image.mode != "RGBA" or runtime_image.size != expected_runtime_size:
                    raise SystemExit(
                        f"труп {key}: runtime ожидался RGBA {expected_runtime_size}, "
                        f"получен {runtime_image.mode} {runtime_image.size}")
                payload[key] = base64.b64encode(runtime_data).decode("ascii")
                source_bytes += len(data)
        html = HTML.read_text(encoding="utf-8")
        html = install_object_payloads(html, "CORPSE_SPRITE_DATA", payload)
        HTML.write_text(html.rstrip("\n") + "\n", encoding="utf-8", newline="\n")
        print(json.dumps({
            "installed": list(payload),
            "sourceBytes": source_bytes,
            "runtimeBytes": sum(len(base64.b64decode(data)) for data in payload.values()),
            "scale": 0.5,
            "alphaFringeCleanup": True,
            "resampled": True,
            "target": str(HTML),
        }, ensure_ascii=False))
        return

    if args.install_corpse_puddles:
        if not args.corpse_puddle_asset_dir or not args.corpse_puddle_asset_dir.is_dir():
            parser.error("лужи трупов требуют существующий --corpse-puddle-asset-dir")
        path = args.corpse_puddle_asset_dir / "blood-puddle-atlas.png"
        if not path.is_file():
            parser.error(f"не найден атлас луж {path}")
        data = path.read_bytes()
        actual_hash = hashlib.sha256(data).hexdigest()
        if actual_hash != CORPSE_PUDDLE_ATLAS_SHA256:
            raise SystemExit(
                f"атлас луж: SHA-256 {actual_hash}, ожидался {CORPSE_PUDDLE_ATLAS_SHA256}")
        image = Image.open(io.BytesIO(data))
        colors = image.getcolors(maxcolors=256) if image.mode == "P" else None
        alpha = image.convert("RGBA").getchannel("A")
        if image.size != (384, 64) or image.mode != "P" or not colors or len(colors) > 96:
            raise SystemExit(
                f"атлас луж: ожидался P 384×64 до 96 индексов, получен {image.mode} {image.size}")
        if alpha.getextrema()[0] != 0 or any(
                not alpha.crop((index * 64, 0, (index + 1) * 64, 64)).getbbox()
                for index in range(6)):
            raise SystemExit("атлас луж: прозрачность отсутствует либо найден пустой кадр")
        html = HTML.read_text(encoding="utf-8")
        html = install_object_payloads(
            html, "CORPSE_PUDDLE_DATA", {"atlas": base64.b64encode(data).decode("ascii")})
        HTML.write_text(html.rstrip("\n") + "\n", encoding="utf-8", newline="\n")
        print(json.dumps({
            "installed": ["small", "medium", "large", "flowing", "bones", "gore"],
            "bytes": len(data),
            "decodedBytes": 384 * 64 * 4,
            "target": str(HTML),
        }, ensure_ascii=False))
        return

    if args.install_blood_assets:
        if not args.blood_asset_dir or not args.blood_asset_dir.is_dir():
            parser.error("система крови требует существующий --blood-asset-dir")
        payload: dict[str, str] = {}
        source_bytes = 0
        for key, (filename, expected_hash, expected_size) in BLOOD_SPRITE_SOURCES.items():
            path = args.blood_asset_dir / filename
            if not path.is_file():
                parser.error(f"лист крови {key}: не найден {path}")
            data = path.read_bytes()
            actual_hash = hashlib.sha256(data).hexdigest()
            if actual_hash != expected_hash:
                raise SystemExit(
                    f"лист крови {key}: SHA-256 {actual_hash}, ожидался {expected_hash}")
            image = Image.open(io.BytesIO(data))
            colors = image.convert("RGBA").getcolors(maxcolors=256)
            if image.size != expected_size or image.mode != "RGBA" or not colors or len(colors) > 16:
                raise SystemExit(
                    f"лист крови {key}: ожидался RGBA {expected_size[0]}×{expected_size[1]} "
                    f"до 16 цветов, получен {image.mode} {image.size}, "
                    f"цветов {len(colors) if colors else 'больше 256'}")
            if not image.getchannel("A").getextrema()[0] == 0:
                raise SystemExit(f"лист крови {key}: отсутствует прозрачный фон")
            payload[key] = base64.b64encode(data).decode("ascii")
            source_bytes += len(data)
        html = HTML.read_text(encoding="utf-8")
        html = install_object_payloads(html, "BLOOD_SPRITE_DATA", payload)
        HTML.write_text(html.rstrip("\n") + "\n", encoding="utf-8", newline="\n")
        print(json.dumps({
            "installed": sorted(payload),
            "sourceBytes": source_bytes,
            "resampled": False,
            "target": str(HTML),
        }, ensure_ascii=False))
        return

    if args.install_subclass_hero_sprites:
        if not args.subclass_hero_asset_dir or not args.subclass_hero_asset_dir.is_dir():
            parser.error("модели подклассов требуют существующий --subclass-hero-asset-dir")
        payload: dict[str, str] = {}
        source_bytes = 0
        for subclass_name, (filename, expected_hash) in SUBCLASS_HERO_SPRITE_SOURCES.items():
            path = args.subclass_hero_asset_dir / filename
            if not path.is_file():
                raise SystemExit(f"модель {subclass_name}: не найден {path}")
            data = path.read_bytes()
            actual_hash = hashlib.sha256(data).hexdigest()
            if actual_hash != expected_hash:
                raise SystemExit(
                    f"модель {subclass_name}: SHA-256 {actual_hash}, ожидался {expected_hash}")
            image = Image.open(io.BytesIO(data))
            colors = image.getcolors(maxcolors=256) if image.mode == "P" else None
            transparency = image.info.get("transparency")
            transparent = transparency == 0 or (isinstance(transparency, bytes) and 0 in transparency)
            if image.size != (288, 36) or image.mode != "P" or not colors or len(colors) > 192:
                raise SystemExit(
                    f"модель {subclass_name}: ожидался P 288×36 до 192 индексов, "
                    f"получен {image.mode} {image.size}, цветов {len(colors) if colors else 'больше 256'}")
            if not transparent:
                raise SystemExit(f"модель {subclass_name}: отсутствует прозрачный индекс")
            alpha = image.convert("RGBA").getchannel("A")
            if any(not alpha.crop((frame * 36, 0, (frame + 1) * 36, 36)).getbbox()
                   for frame in range(8)):
                raise SystemExit(f"модель {subclass_name}: найден пустой кадр")
            payload[subclass_name] = base64.b64encode(data).decode("ascii")
            source_bytes += len(data)
        html = HTML.read_text(encoding="utf-8")
        if "const SUBCLASS_HERO_SPRITE_DATA = {" not in html:
            anchor = "const HERO_SPRITE_DATA = {"
            if anchor not in html:
                raise SystemExit("не найден якорь HERO_SPRITE_DATA для моделей подклассов")
            html = html.replace(anchor, "const SUBCLASS_HERO_SPRITE_DATA = {\n};\n" + anchor, 1)
        html = install_object_payloads(html, "SUBCLASS_HERO_SPRITE_DATA", payload)
        HTML.write_text(html.rstrip("\n") + "\n", encoding="utf-8", newline="\n")
        print(json.dumps({
            "installed": list(payload),
            "sourceBytes": source_bytes,
            "resampled": False,
            "target": str(HTML),
        }, ensure_ascii=False))
        return

    if args.install_subclass_frames:
        if not args.subclass_frame_asset_dir or not args.subclass_frame_asset_dir.is_dir():
            parser.error("рамки подклассов требуют существующий --subclass-frame-asset-dir")
        payload: dict[str, str] = {}
        source_bytes = 0
        for subclass_name, (filename, expected_hash) in SUBCLASS_FRAME_SOURCES.items():
            path = args.subclass_frame_asset_dir / filename
            if not path.is_file():
                raise SystemExit(f"рамка {subclass_name}: не найден {path}")
            data = path.read_bytes()
            actual_hash = hashlib.sha256(data).hexdigest()
            if actual_hash != expected_hash:
                raise SystemExit(
                    f"рамка {subclass_name}: SHA-256 {actual_hash}, ожидался {expected_hash}")
            image = Image.open(io.BytesIO(data))
            colors = image.getcolors(maxcolors=256) if image.mode == "P" else None
            transparency = image.info.get("transparency")
            if (image.size != (320, 400) or image.mode != "P" or not colors or
                    len(colors) > FRAME_PALETTE_COLORS or not isinstance(transparency, bytes) or
                    0 not in transparency):
                raise SystemExit(
                    f"рамка {subclass_name}: ожидался прозрачный P 320×400 до "
                    f"{FRAME_PALETTE_COLORS} индексов, получен {image.mode} {image.size}")
            payload[subclass_name] = base64.b64encode(data).decode("ascii")
            source_bytes += len(data)
        html = HTML.read_text(encoding="utf-8")
        if "const SUBCLASS_FRAME_DATA = {" not in html:
            anchor = "const CLASS_FRAME_DATA = {"
            if anchor not in html:
                raise SystemExit("не найден якорь CLASS_FRAME_DATA для рамок подклассов")
            html = html.replace(anchor, "const SUBCLASS_FRAME_DATA = {\n};\n" + anchor, 1)
        html = install_object_payloads(html, "SUBCLASS_FRAME_DATA", payload)
        HTML.write_text(html.rstrip("\n") + "\n", encoding="utf-8")
        print(json.dumps({
            "installed": sorted(payload),
            "sourceBytes": source_bytes,
            "optimizedBytes": source_bytes,
            "paletteColors": FRAME_PALETTE_COLORS,
            "target": str(HTML),
        }, ensure_ascii=False))
        return

    if args.install_shop_icon_atlas:
        if not args.shop_icon_atlas or not args.shop_icon_atlas.is_file():
            parser.error("иконки магазина требуют существующий --shop-icon-atlas")
        data = shop_icon_atlas(args.shop_icon_atlas)
        optimized_path = ROOT / "assets" / "shop-upgrade-icons-atlas-v1-optimized.png"
        optimized_path.parent.mkdir(parents=True, exist_ok=True)
        optimized_path.write_bytes(data)
        value = base64.b64encode(data).decode("ascii")
        html = HTML.read_text(encoding="utf-8")
        html, count = re.subn(
            r"const SHOP_ICON_ATLAS_DATA = 'data:image/png;base64,[^']*';",
            f"const SHOP_ICON_ATLAS_DATA = 'data:image/png;base64,{value}';", html, count=1)
        if count != 1:
            raise SystemExit(f"SHOP_ICON_ATLAS_DATA: ожидалась одна замена, получено {count}")
        HTML.write_text(html.rstrip("\n") + "\n", encoding="utf-8")
        print(json.dumps({
            "source": str(args.shop_icon_atlas),
            "optimized": str(optimized_path),
            "bytes": len(data),
            "target": str(HTML),
        }, ensure_ascii=False))
        return

    if args.install_constellation_observatory:
        if not args.constellation_observatory or not args.constellation_observatory.is_file():
            parser.error("обсерватория требует существующий --constellation-observatory")
        source_data = args.constellation_observatory.read_bytes()
        actual_source = hashlib.sha256(source_data).hexdigest()
        if actual_source != CONSTELLATION_OBSERVATORY_SOURCE_SHA256:
            raise SystemExit(
                f"обсерватория: SHA-256 {actual_source}, ожидался {CONSTELLATION_OBSERVATORY_SOURCE_SHA256}")
        source = Image.open(io.BytesIO(source_data)).convert("RGB")
        if source.size != (1536, 1024):
            raise SystemExit(f"обсерватория: ожидался размер 1536x1024, получен {source.size}")
        runtime = source.resize((1280, 853), Image.Resampling.LANCZOS)
        encoded = io.BytesIO()
        runtime.save(encoded, "WEBP", quality=62, method=6)
        data = encoded.getvalue()
        actual_webp = hashlib.sha256(data).hexdigest()
        if actual_webp != CONSTELLATION_OBSERVATORY_WEBP_SHA256:
            raise SystemExit(
                f"сжатая обсерватория: SHA-256 {actual_webp}, ожидался {CONSTELLATION_OBSERVATORY_WEBP_SHA256}")
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "constellation-observatory.webp"
        path.write_bytes(data)
        html = HTML.read_text(encoding="utf-8")
        value = base64.b64encode(data).decode("ascii")
        html, count = re.subn(
            r'(#constellations\{[^}]*?)(url\("(?:assets/generated/constellation-observatory-v1\.png|data:image/webp;base64,[A-Za-z0-9+/=]+)"\))',
            lambda match: match.group(1) + f'url("data:image/webp;base64,{value}")',
            html, count=1, flags=re.S)
        if count != 1:
            raise SystemExit(f"фон обсерватории в CSS: ожидалась одна замена, получено {count}")
        HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({
            "source": str(args.constellation_observatory),
            "sourceBytes": len(source_data),
            "runtime": str(path),
            "runtimeBytes": len(data),
            "runtimeSize": [1280, 853],
            "quality": 62,
            "target": str(HTML),
        }, ensure_ascii=False, separators=(",", ":")))
        return

    if args.install_menu_background:
        if not args.menu_background or not args.menu_background.is_file():
            parser.error("фон меню требует существующий --menu-background")
        source_data = args.menu_background.read_bytes()
        actual_source = hashlib.sha256(source_data).hexdigest()
        if actual_source != MENU_BACKGROUND_SOURCE_SHA256:
            raise SystemExit(
                f"фон меню: SHA-256 {actual_source}, ожидался {MENU_BACKGROUND_SOURCE_SHA256}")
        source = Image.open(io.BytesIO(source_data)).convert("RGB")
        if source.size != (1672, 941):
            raise SystemExit(f"фон меню: ожидался размер 1672×941, получен {source.size}")
        encoded = io.BytesIO()
        source.save(encoded, "WEBP", quality=35, method=6)
        data = encoded.getvalue()
        actual_webp = hashlib.sha256(data).hexdigest()
        if actual_webp != MENU_BACKGROUND_WEBP_SHA256:
            raise SystemExit(
                f"сжатый фон меню: SHA-256 {actual_webp}, ожидался {MENU_BACKGROUND_WEBP_SHA256}")
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "grim-grind-menu-background.webp"
        path.write_bytes(data)
        html = HTML.read_text(encoding="utf-8")
        value = base64.b64encode(data).decode("ascii")
        html, count = re.subn(
            r'url\("(?:assets/menu-forge-background\.png|data:image/webp;base64,[A-Za-z0-9+/=]+)"\) center/cover no-repeat',
            f'url("data:image/webp;base64,{value}") center/cover no-repeat', html, count=1)
        if count != 1:
            raise SystemExit(f"фон меню в CSS: ожидалась одна замена, получено {count}")
        HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(data),
                          "base64Bytes": len(value)}, separators=(",", ":")))
        return

    if args.install_mage_attack_sounds:
        if not args.mage_attack_sounds or any(not path.is_file() for path in args.mage_attack_sounds):
            parser.error("атаки Мага требуют четыре существующих --mage-attack-sounds")
        payloads = []
        for index, (path, expected_hash) in enumerate(
                zip(args.mage_attack_sounds, MAGE_ATTACK_SOUND_SHA256), start=1):
            data = path.read_bytes()
            actual = hashlib.sha256(data).hexdigest()
            if actual != expected_hash:
                raise SystemExit(
                    f"атака Мага {index}: SHA-256 {actual}, ожидался {expected_hash}")
            if not data.startswith(b"OggS") or b"vorbis" not in data[:512]:
                raise SystemExit(f"атака Мага {index}: ожидался контейнер OGG/Vorbis")
            payloads.append("  'data:audio/ogg;base64," + base64.b64encode(data).decode("ascii") + "'")
        html = HTML.read_text(encoding="utf-8")
        value = "[\n" + ",\n".join(payloads) + "\n]"
        html, count = re.subn(
            r"const MAGE_ATTACK_SOUND_DATA = \[[\s\S]*?\];",
            f"const MAGE_ATTACK_SOUND_DATA = {value};", html, count=1)
        if count != 1:
            raise SystemExit(f"MAGE_ATTACK_SOUND_DATA: ожидалась одна замена, получено {count}")
        HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"files": len(payloads),
                          "bytes": sum(path.stat().st_size for path in args.mage_attack_sounds)},
                         separators=(",", ":")))
        return

    if args.install_warrior_attack_sounds:
        if not args.warrior_attack_sounds or any(not path.is_file() for path in args.warrior_attack_sounds):
            parser.error("атаки Воина требуют четыре существующих --warrior-attack-sounds")
        payloads = []
        for index, (path, expected_hash) in enumerate(
                zip(args.warrior_attack_sounds, WARRIOR_ATTACK_SOUND_SHA256), start=1):
            data = path.read_bytes()
            actual = hashlib.sha256(data).hexdigest()
            if actual != expected_hash:
                raise SystemExit(
                    f"атака Воина {index}: SHA-256 {actual}, ожидался {expected_hash}")
            if not data.startswith(b"OggS") or b"vorbis" not in data[:512]:
                raise SystemExit(f"атака Воина {index}: ожидался контейнер OGG/Vorbis")
            payloads.append("  'data:audio/ogg;base64," + base64.b64encode(data).decode("ascii") + "'")
        html = HTML.read_text(encoding="utf-8")
        value = "[\n" + ",\n".join(payloads) + "\n]"
        html, count = re.subn(
            r"const WARRIOR_ATTACK_SOUND_DATA = \[[\s\S]*?\];",
            f"const WARRIOR_ATTACK_SOUND_DATA = {value};", html, count=1)
        if count != 1:
            raise SystemExit(f"WARRIOR_ATTACK_SOUND_DATA: ожидалась одна замена, получено {count}")
        HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"files": len(payloads),
                          "bytes": sum(path.stat().st_size for path in args.warrior_attack_sounds)},
                         separators=(",", ":")))
        return

    if args.install_archer_shot_sounds:
        if not args.archer_shot_sounds or any(not path.is_file() for path in args.archer_shot_sounds):
            parser.error("выстрелы Лучника требуют четыре существующих --archer-shot-sounds")
        payloads = []
        for index, (path, expected_hash) in enumerate(
                zip(args.archer_shot_sounds, ARCHER_SHOT_SOUND_SHA256), start=1):
            data = path.read_bytes()
            actual = hashlib.sha256(data).hexdigest()
            if actual != expected_hash:
                raise SystemExit(
                    f"выстрел Лучника {index}: SHA-256 {actual}, ожидался {expected_hash}")
            if not data.startswith(b"OggS") or b"vorbis" not in data[:512]:
                raise SystemExit(f"выстрел Лучника {index}: ожидался контейнер OGG/Vorbis")
            payloads.append("  'data:audio/ogg;base64," + base64.b64encode(data).decode("ascii") + "'")
        html = HTML.read_text(encoding="utf-8")
        value = "[\n" + ",\n".join(payloads) + "\n]"
        html, count = re.subn(
            r"const ARCHER_SHOT_SOUND_DATA = \[[\s\S]*?\];",
            f"const ARCHER_SHOT_SOUND_DATA = {value};", html, count=1)
        if count != 1:
            raise SystemExit(f"ARCHER_SHOT_SOUND_DATA: ожидалась одна замена, получено {count}")
        HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"files": len(payloads),
                          "bytes": sum(path.stat().st_size for path in args.archer_shot_sounds)},
                         separators=(",", ":")))
        return

    if args.install_hover_sound:
        if not args.hover_sound or not args.hover_sound.is_file():
            parser.error("звук наведения требует существующий --hover-sound")
        data = args.hover_sound.read_bytes()
        actual = hashlib.sha256(data).hexdigest()
        if actual != HOVER_SOUND_SHA256:
            raise SystemExit(
                f"звук наведения: SHA-256 {actual}, ожидался {HOVER_SOUND_SHA256}")
        if not data.startswith(b"OggS") or b"OpusHead" not in data[:512]:
            raise SystemExit("звук наведения: ожидался контейнер OGG с потоком Opus")
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "grim-grind-hover-ui.opus"
        path.write_bytes(data)
        html = HTML.read_text(encoding="utf-8")
        value = base64.b64encode(data).decode("ascii")
        html, count = re.subn(
            r"const HOVER_SOUND_DATA = 'data:audio/ogg;codecs=opus;base64,[^']*';",
            f"const HOVER_SOUND_DATA = 'data:audio/ogg;codecs=opus;base64,{value}';", html, count=1)
        if count != 1:
            raise SystemExit(f"HOVER_SOUND_DATA: ожидалась одна замена, получено {count}")
        HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(data),
                          "base64Bytes": len(value)}, separators=(",", ":")))
        return

    if args.install_confirm_sound:
        if not args.confirm_sound or not args.confirm_sound.is_file():
            parser.error("звук подтверждения требует существующий --confirm-sound")
        data = args.confirm_sound.read_bytes()
        actual = hashlib.sha256(data).hexdigest()
        if actual != CONFIRM_SOUND_SHA256:
            raise SystemExit(
                f"звук подтверждения: SHA-256 {actual}, ожидался {CONFIRM_SOUND_SHA256}")
        if not data.startswith(b"OggS") or b"OpusHead" not in data[:512]:
            raise SystemExit("звук подтверждения: ожидался контейнер OGG с потоком Opus")
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "grim-grind-confirm-click.opus"
        path.write_bytes(data)
        html = HTML.read_text(encoding="utf-8")
        value = base64.b64encode(data).decode("ascii")
        html, count = re.subn(
            r"const CONFIRM_SOUND_DATA = 'data:audio/ogg;codecs=opus;base64,[^']*';",
            f"const CONFIRM_SOUND_DATA = 'data:audio/ogg;codecs=opus;base64,{value}';", html, count=1)
        if count != 1:
            raise SystemExit(f"CONFIRM_SOUND_DATA: ожидалась одна замена, получено {count}")
        HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(data),
                          "base64Bytes": len(value)}, separators=(",", ":")))
        return

    if args.install_menu_music:
        if not args.menu_music or not args.menu_music.is_file():
            parser.error("музыка меню требует существующий --menu-music")
        data = args.menu_music.read_bytes()
        actual = hashlib.sha256(data).hexdigest()
        if actual != MENU_MUSIC_SHA256:
            raise SystemExit(
                f"музыка меню: SHA-256 {actual}, ожидался {MENU_MUSIC_SHA256}")
        if not data.startswith(b"OggS") or b"vorbis" not in data[:4096]:
            raise SystemExit("музыка меню: ожидался контейнер OGG с потоком Vorbis")
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "grim-grind-menu-music.ogg"
        path.write_bytes(data)
        html = HTML.read_text(encoding="utf-8")
        value = base64.b64encode(data).decode("ascii")
        html, count = re.subn(
            r"const MENU_MUSIC_DATA = 'data:audio/ogg;base64,[^']*';",
            f"const MENU_MUSIC_DATA = 'data:audio/ogg;base64,{value}';", html, count=1)
        if count != 1:
            raise SystemExit(f"MENU_MUSIC_DATA: ожидалась одна замена, получено {count}")
        HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(data),
                          "base64Bytes": len(value)}, separators=(",", ":")))
        return

    if args.build_puddle_sprites or args.install_puddle_sprites:
        if not args.puddle_sprite_dir:
            parser.error("лужи требуют --puddle-sprite-dir")
        sources = {}
        for key, (filename, expected, frame_size, _) in PUDDLE_SPRITE_SOURCES.items():
            path = args.puddle_sprite_dir / filename
            if not path.is_file():
                parser.error(f"лужа {key}: не найден {path}")
            actual = hashlib.sha256(path.read_bytes()).hexdigest()
            if actual != expected:
                raise SystemExit(f"лужа {key}: SHA-256 {actual}, ожидался {expected}")
            sources[key] = (path, frame_size)
        generated = {key: puddle_sprite_sheet(path, frame_size)
                     for key, (path, frame_size) in sources.items()}
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        paths = {key: output_dir / PUDDLE_SPRITE_SOURCES[key][3] for key in generated}
        for key, path in paths.items():
            path.write_bytes(generated[key])
        if args.install_puddle_sprites:
            html = HTML.read_text(encoding="utf-8")
            body = "const GROUND_POOL_SPRITE_DATA = {\n" + "\n".join(
                f"  {key}:'data:image/png;base64,{base64.b64encode(data).decode('ascii')}',"
                for key, data in generated.items()) + "\n};"
            html, count = re.subn(r"const GROUND_POOL_SPRITE_DATA = \{.*?\n\};",
                                  body, html, count=1, flags=re.S)
            if count != 1:
                raise SystemExit(
                    f"GROUND_POOL_SPRITE_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({
            key: {"path": str(paths[key]), "bytes": len(data),
                  "size": Image.open(io.BytesIO(data)).size}
            for key, data in generated.items()
        }, separators=(",", ":")))
        return

    if args.build_loot_sprites or args.install_loot_sprites:
        sources = {
            "pickupXp": (args.pickup_xp, 16, "pickup-xp-4f-optimized.png"),
            "pickupGold": (args.pickup_gold, 16, "pickup-gold-4f-optimized.png"),
            "fire": (args.book_fire, 24, "book-fire-4f-optimized.png"),
            "cold": (args.book_cold, 24, "book-cold-4f-optimized.png"),
            "shock": (args.book_lightning, 24, "book-lightning-4f-optimized.png"),
            "poison": (args.book_poison, 24, "book-poison-4f-optimized.png"),
            "bleed": (args.book_bleed, 24, "book-bleed-4f-optimized.png"),
            "xp": (args.book_xp, 24, "book-xp-4f-optimized.png"),
            "monster": (args.book_monster, 24, "book-monster-4f-optimized.png"),
        }
        missing = [key for key, (path, _, _) in sources.items() if not path]
        if missing:
            parser.error("спрайты наземного лута: отсутствуют " + ", ".join(missing))
        generated = {key: loot_sprite_sheet(path, size)
                     for key, (path, size, _) in sources.items()}
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        paths = {key: output_dir / filename
                 for key, (_, _, filename) in sources.items()}
        for key, path in paths.items():
            path.write_bytes(generated[key])
        if args.install_loot_sprites:
            html = HTML.read_text(encoding="utf-8")
            payload = {key: base64.b64encode(data).decode("ascii")
                       for key, data in generated.items()}
            body = "const LOOT_SPRITE_DATA = {\n" + "\n".join(
                f"  {key}:'data:image/png;base64,{value}',"
                for key, value in payload.items()) + "\n};"
            html, count = re.subn(r"const LOOT_SPRITE_DATA = \{.*?\n\};",
                                  body, html, flags=re.S)
            if count != 1:
                raise SystemExit(f"LOOT_SPRITE_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({
            key: {"path": str(paths[key]), "bytes": len(data),
                  "size": Image.open(io.BytesIO(data)).size}
            for key, data in generated.items()
        }, separators=(",", ":")))
        return

    if args.build_enemy_status_icons or args.install_enemy_status_icons:
        if not args.enemy_status_icons:
            parser.error("индикаторы врагов требуют --enemy-status-icons")
        if not args.enemy_status_icons.is_file():
            parser.error(f"не найден master индикаторов: {args.enemy_status_icons}")
        generated = enemy_status_icon_sheet(args.enemy_status_icons)
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "enemy-elemental-status-icons-7f-optimized.png"
        path.write_bytes(generated)
        if args.install_enemy_status_icons:
            html = HTML.read_text(encoding="utf-8")
            value = base64.b64encode(generated).decode("ascii")
            html, count = re.subn(
                r"(const ENEMY_STATUS_ICON_DATA = ')[^']*(';)",
                rf"\g<1>data:image/png;base64,{value}\2", html, count=1)
            if count != 1:
                raise SystemExit(
                    f"ENEMY_STATUS_ICON_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(generated),
                          "size": Image.open(io.BytesIO(generated)).size,
                          "keys": [key for key, _, _ in ENEMY_STATUS_ICON_CELLS]},
                         separators=(",", ":")))
        return

    if args.build_floor_portal or args.install_floor_portal:
        if not args.floor_portal:
            parser.error("портал завершения этажа требует --floor-portal")
        if not args.floor_portal.is_file():
            parser.error(f"не найден лист портала: {args.floor_portal}")
        generated = floor_portal_sprite_sheet(args.floor_portal)
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "floor-completion-portal-8x128-lossless.png"
        path.write_bytes(generated)
        if args.install_floor_portal:
            html = HTML.read_text(encoding="utf-8")
            value = base64.b64encode(generated).decode("ascii")
            html, count = re.subn(
                r"(const FLOOR_PORTAL_SPRITE_DATA = ')[^']*(';)",
                rf"\g<1>data:image/png;base64,{value}\2", html, count=1)
            if count != 1:
                raise SystemExit(
                    f"FLOOR_PORTAL_SPRITE_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(generated),
                          "size": Image.open(io.BytesIO(generated)).size,
                          "frames": 8, "frameMs": 100},
                         separators=(",", ":")))
        return

    if args.build_totem_sprites or args.install_totem_sprites:
        if not args.totem_sprite_dir or not args.lightning_totem_sprite_dir:
            parser.error("тотемы требуют --totem-sprite-dir и --lightning-totem-sprite-dir")
        specs = dict(TOTEM_SPRITE_SOURCES)
        specs["lightning"] = LIGHTNING_TOTEM_SPRITE_SOURCES
        roots = {key: args.totem_sprite_dir for key in TOTEM_SPRITE_SOURCES}
        roots["lightning"] = args.lightning_totem_sprite_dir
        sources: dict[str, list[Path]] = {}
        for key, entries in specs.items():
            sources[key] = []
            for filename, expected in entries:
                path = roots[key] / filename
                if not path.is_file():
                    parser.error(f"тотем {key}: не найден {path}")
                actual = hashlib.sha256(path.read_bytes()).hexdigest()
                if actual != expected:
                    raise SystemExit(
                        f"тотем {key} {filename}: SHA-256 {actual}, ожидался {expected}")
                sources[key].append(path)
        generated = {key: [totem_sprite(path) for path in paths]
                     for key, paths in sources.items()}
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        paths = {key: [output_dir / f"totem-{key}-r{rank}-optimized.png"
                       for rank in range(1, 5)] for key in generated}
        for key, images in generated.items():
            for path, data in zip(paths[key], images):
                path.write_bytes(data)
        if args.install_totem_sprites:
            html = HTML.read_text(encoding="utf-8")
            rows = []
            for key, images in generated.items():
                values = ",".join(
                    f"'data:image/png;base64,{base64.b64encode(data).decode('ascii')}'"
                    for data in images)
                rows.append(f"  {key}:[{values}],")
            body = "const TOTEM_SPRITE_DATA = {\n" + "\n".join(rows) + "\n};"
            html, count = re.subn(r"const TOTEM_SPRITE_DATA = \{.*?\n\};",
                                  body, html, count=1, flags=re.S)
            if count != 1:
                raise SystemExit(
                    f"TOTEM_SPRITE_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({
            key: {"paths": [str(path) for path in paths[key]],
                  "bytes": [len(data) for data in images], "size": [24, 24]}
            for key, images in generated.items()
        }, separators=(",", ":")))
        return

    if args.build_legendary_item_icons or args.install_legendary_item_icons:
        if not args.legendary_item_dir:
            parser.error("легендарные предметы требуют --legendary-item-dir")
        sources = {key: args.legendary_item_dir / filename
                   for key, (filename, _) in LEGENDARY_ITEM_SOURCES.items()}
        for key, path in sources.items():
            if not path.is_file():
                parser.error(f"легендарный предмет {key}: не найден {path}")
            expected = LEGENDARY_ITEM_SOURCES[key][1]
            actual = hashlib.sha256(path.read_bytes()).hexdigest()
            if actual != expected:
                raise SystemExit(f"легендарный предмет {key}: SHA-256 {actual}, ожидался {expected}")
        generated = {key: rare_item_sprite(path) for key, path in sources.items()}
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        paths = {key: output_dir / f"legendary-item-{key}-optimized.png" for key in generated}
        for key, path in paths.items():
            path.write_bytes(generated[key])
        if args.install_legendary_item_icons:
            html = HTML.read_text(encoding="utf-8")
            payload = {key: base64.b64encode(data).decode("ascii")
                       for key, data in generated.items()}
            html = install_object_payloads(html, "RARE_ITEM_SPRITE_DATA", payload)
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({
            key: {"path": str(paths[key]), "bytes": len(data),
                  "size": Image.open(io.BytesIO(data)).size}
            for key, data in generated.items()
        }, separators=(",", ":")))
        return

    if args.build_epic_item_icons or args.install_epic_item_icons:
        if not args.epic_item_dir:
            parser.error("эпические предметы требуют --epic-item-dir")
        sources = {key: args.epic_item_dir / filename
                   for key, (filename, _) in EPIC_ITEM_SOURCES.items()}
        for key, path in sources.items():
            if not path.is_file():
                parser.error(f"эпический предмет {key}: не найден {path}")
            expected = EPIC_ITEM_SOURCES[key][1]
            actual = hashlib.sha256(path.read_bytes()).hexdigest()
            if actual != expected:
                raise SystemExit(f"эпический предмет {key}: SHA-256 {actual}, ожидался {expected}")
        generated = {key: rare_item_sprite(path) for key, path in sources.items()}
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        paths = {key: output_dir / f"epic-item-{key}-optimized.png" for key in generated}
        for key, path in paths.items():
            path.write_bytes(generated[key])
        if args.install_epic_item_icons:
            html = HTML.read_text(encoding="utf-8")
            payload = {key: base64.b64encode(data).decode("ascii")
                       for key, data in generated.items()}
            html = install_object_payloads(html, "RARE_ITEM_SPRITE_DATA", payload)
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({
            key: {"path": str(paths[key]), "bytes": len(data),
                  "size": Image.open(io.BytesIO(data)).size}
            for key, data in generated.items()
        }, separators=(",", ":")))
        return

    if args.build_rare_item_sprites or args.install_rare_item_sprites:
        if not args.rare_item_dir:
            parser.error("редкие предметы требуют --rare-item-dir")
        sources = {key: args.rare_item_dir / filename
                   for key, (filename, _) in RARE_ITEM_SOURCES.items()}
        for key, path in sources.items():
            if not path.is_file():
                parser.error(f"редкий предмет {key}: не найден {path}")
            expected = RARE_ITEM_SOURCES[key][1]
            actual = hashlib.sha256(path.read_bytes()).hexdigest()
            if actual != expected:
                raise SystemExit(f"редкий предмет {key}: SHA-256 {actual}, ожидался {expected}")
        generated = {key: rare_item_sprite(path) for key, path in sources.items()}
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        paths = {key: output_dir / f"rare-item-{key}-optimized.png" for key in generated}
        for key, path in paths.items():
            path.write_bytes(generated[key])
        if args.install_rare_item_sprites:
            html = HTML.read_text(encoding="utf-8")
            payload = {key: base64.b64encode(data).decode("ascii")
                       for key, data in generated.items()}
            html = install_object_payloads(html, "RARE_ITEM_SPRITE_DATA", payload)
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({
            key: {"path": str(paths[key]), "bytes": len(data),
                  "size": Image.open(io.BytesIO(data)).size}
            for key, data in generated.items()
        }, separators=(",", ":")))
        return

    if args.build_amulet_icons or args.install_amulet_icons:
        if not args.amulet_icon_dir:
            parser.error("иконки амулетов требуют --amulet-icon-dir")
        sources = {key: args.amulet_icon_dir / filename
                   for key, (filename, _) in AMULET_ICON_SOURCES.items()}
        for key, path in sources.items():
            if not path.is_file():
                parser.error(f"амулет {key}: не найден {path}")
            expected = AMULET_ICON_SOURCES[key][1]
            actual = hashlib.sha256(path.read_bytes()).hexdigest()
            if actual != expected:
                raise SystemExit(f"амулет {key}: SHA-256 {actual}, ожидался {expected}")
        generated = {key: rare_item_sprite(path) for key, path in sources.items()}
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        paths = {key: output_dir / f"amulet-{key}-optimized.png" for key in generated}
        for key, path in paths.items():
            path.write_bytes(generated[key])
        if args.install_amulet_icons:
            html = HTML.read_text(encoding="utf-8")
            payload = {key: base64.b64encode(data).decode("ascii")
                       for key, data in generated.items()}
            html = install_object_payloads(html, "RARE_ITEM_SPRITE_DATA", payload)
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({
            key: {"path": str(paths[key]), "bytes": len(data),
                  "size": Image.open(io.BytesIO(data)).size}
            for key, data in generated.items()
        }, separators=(",", ":")))
        return

    if args.build_glove_icons or args.install_glove_icons:
        if not args.glove_icon_dir:
            parser.error("иконки перчаток требуют --glove-icon-dir")
        sources = {key: args.glove_icon_dir / filename
                   for key, (filename, _) in GLOVE_ICON_SOURCES.items()}
        for key, path in sources.items():
            if not path.is_file():
                parser.error(f"перчатки {key}: не найден {path}")
            expected = GLOVE_ICON_SOURCES[key][1]
            actual = hashlib.sha256(path.read_bytes()).hexdigest()
            if actual != expected:
                raise SystemExit(f"перчатки {key}: SHA-256 {actual}, ожидался {expected}")
        generated = {key: rare_item_sprite(path) for key, path in sources.items()}
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        paths = {key: output_dir / f"glove-{key}-optimized.png" for key in generated}
        for key, path in paths.items():
            path.write_bytes(generated[key])
        if args.install_glove_icons:
            html = HTML.read_text(encoding="utf-8")
            payload = {key: base64.b64encode(data).decode("ascii")
                       for key, data in generated.items()}
            html = install_object_payloads(html, "RARE_ITEM_SPRITE_DATA", payload)
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({
            key: {"path": str(paths[key]), "bytes": len(data),
                  "size": Image.open(io.BytesIO(data)).size}
            for key, data in generated.items()
        }, separators=(",", ":")))
        return

    if args.build_boot_icons or args.install_boot_icons:
        if not args.boot_icon_dir:
            parser.error("иконки ботинок требуют --boot-icon-dir")
        sources = {key: args.boot_icon_dir / filename
                   for key, (filename, _) in BOOT_ICON_SOURCES.items()}
        for key, path in sources.items():
            if not path.is_file():
                parser.error(f"ботинки {key}: не найден {path}")
            expected = BOOT_ICON_SOURCES[key][1]
            actual = hashlib.sha256(path.read_bytes()).hexdigest()
            if actual != expected:
                raise SystemExit(f"ботинки {key}: SHA-256 {actual}, ожидался {expected}")
        generated = {key: rare_item_sprite(path) for key, path in sources.items()}
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        paths = {key: output_dir / f"boot-{key}-optimized.png" for key in generated}
        for key, path in paths.items():
            path.write_bytes(generated[key])
        if args.install_boot_icons:
            html = HTML.read_text(encoding="utf-8")
            payload = {key: base64.b64encode(data).decode("ascii")
                       for key, data in generated.items()}
            html = install_object_payloads(html, "RARE_ITEM_SPRITE_DATA", payload)
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({
            key: {"path": str(paths[key]), "bytes": len(data),
                  "size": Image.open(io.BytesIO(data)).size}
            for key, data in generated.items()
        }, separators=(",", ":")))
        return

    if args.build_ring_icons or args.install_ring_icons:
        if not args.ring_icon_dir:
            parser.error("иконки колец требуют --ring-icon-dir")
        sources = {key: args.ring_icon_dir / filename
                   for key, (filename, _) in RING_ICON_SOURCES.items()}
        for key, path in sources.items():
            if not path.is_file():
                parser.error(f"кольцо {key}: не найден {path}")
            expected = RING_ICON_SOURCES[key][1]
            actual = hashlib.sha256(path.read_bytes()).hexdigest()
            if actual != expected:
                raise SystemExit(f"кольцо {key}: SHA-256 {actual}, ожидался {expected}")
        generated = {key: rare_item_sprite(path) for key, path in sources.items()}
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        paths = {key: output_dir / f"ring-{key}-optimized.png" for key in generated}
        for key, path in paths.items():
            path.write_bytes(generated[key])
        if args.install_ring_icons:
            html = HTML.read_text(encoding="utf-8")
            payload = {key: base64.b64encode(data).decode("ascii")
                       for key, data in generated.items()}
            html = install_object_payloads(html, "RARE_ITEM_SPRITE_DATA", payload)
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({
            key: {"path": str(paths[key]), "bytes": len(data),
                  "size": Image.open(io.BytesIO(data)).size}
            for key, data in generated.items()
        }, separators=(",", ":")))
        return

    if args.build_relic_icons or args.install_relic_icons:
        if not args.relic_icon_dir:
            parser.error("иконки реликвий требуют --relic-icon-dir")
        sources = {key: args.relic_icon_dir / filename
                   for key, (filename, _) in RELIC_ICON_SOURCES.items()}
        for key, path in sources.items():
            if not path.is_file():
                parser.error(f"реликвия {key}: не найдена {path}")
            expected = RELIC_ICON_SOURCES[key][1]
            actual = hashlib.sha256(path.read_bytes()).hexdigest()
            if actual != expected:
                raise SystemExit(f"реликвия {key}: SHA-256 {actual}, ожидался {expected}")
        generated = {key: rare_item_sprite(path) for key, path in sources.items()}
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        paths = {key: output_dir / f"relic-{key}-optimized.png" for key in generated}
        for key, path in paths.items():
            path.write_bytes(generated[key])
        if args.install_relic_icons:
            html = HTML.read_text(encoding="utf-8")
            payload = {key: base64.b64encode(data).decode("ascii")
                       for key, data in generated.items()}
            html = install_object_payloads(html, "RARE_ITEM_SPRITE_DATA", payload)
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({
            key: {"path": str(paths[key]), "bytes": len(data),
                  "size": Image.open(io.BytesIO(data)).size}
            for key, data in generated.items()
        }, separators=(",", ":")))
        return

    if args.build_void_ground_rift or args.install_void_ground_rift:
        if not args.void_ground_rift:
            parser.error("Наземный Разлом Пустоты требует --void-ground-rift")
        generated = void_ground_rift_sheet(args.void_ground_rift)
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "void-wrath-ground-rift-4f-optimized.png"
        path.write_bytes(generated)
        if args.install_void_ground_rift:
            html = HTML.read_text(encoding="utf-8")
            value = base64.b64encode(generated).decode("ascii")
            html, count = re.subn(
                r"(const VOID_GROUND_RIFT_DATA = ')[^']*(';)",
                rf"\g<1>data:image/png;base64,{value}\2", html, count=1)
            if count != 1:
                raise SystemExit(f"VOID_GROUND_RIFT_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(generated),
                          "size": Image.open(io.BytesIO(generated)).size},
                         separators=(",", ":")))
        return

    if args.build_matriarch_plague_projectile or args.install_matriarch_plague_projectile:
        if not args.matriarch_plague_projectile:
            parser.error("Чумной снаряд требует --matriarch-plague-projectile")
        generated = matriarch_plague_projectile_sheet(args.matriarch_plague_projectile)
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "plague-matriarch-projectile-4f-optimized.png"
        path.write_bytes(generated)
        if args.install_matriarch_plague_projectile:
            html = HTML.read_text(encoding="utf-8")
            value = base64.b64encode(generated).decode("ascii")
            html, count = re.subn(
                r"(const MATRIARCH_PLAGUE_PROJECTILE_DATA = ')[^']*(';)",
                rf"\g<1>data:image/png;base64,{value}\2", html, count=1)
            if count != 1:
                raise SystemExit(f"MATRIARCH_PLAGUE_PROJECTILE_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(generated),
                          "size": Image.open(io.BytesIO(generated)).size},
                         separators=(",", ":")))
        return

    if args.build_demon_queen_blob or args.install_demon_queen_blob:
        if not args.demon_queen_blob:
            parser.error("Демонический сгусток требует --demon-queen-blob")
        generated = demon_queen_blob_sheet(args.demon_queen_blob)
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "demon-queen-blob-4f-optimized.png"
        path.write_bytes(generated)
        if args.install_demon_queen_blob:
            html = HTML.read_text(encoding="utf-8")
            value = base64.b64encode(generated).decode("ascii")
            html, count = re.subn(
                r"(const DEMON_QUEEN_BLOB_DATA = ')[^']*(';)",
                rf"\g<1>data:image/png;base64,{value}\2", html, count=1)
            if count != 1:
                raise SystemExit(f"DEMON_QUEEN_BLOB_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(generated),
                          "size": Image.open(io.BytesIO(generated)).size},
                         separators=(",", ":")))
        return

    if args.build_seraph_holy_spear or args.install_seraph_holy_spear:
        if not args.seraph_holy_spear:
            parser.error("Святое Копьё требует --seraph-holy-spear")
        generated = seraph_holy_spear_sheet(args.seraph_holy_spear)
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "fallen-seraph-holy-spear-4f-optimized.png"
        path.write_bytes(generated)
        if args.install_seraph_holy_spear:
            html = HTML.read_text(encoding="utf-8")
            value = base64.b64encode(generated).decode("ascii")
            html, count = re.subn(
                r"(const SERAPH_HOLY_SPEAR_DATA = ')[^']*(';)",
                rf"\g<1>data:image/png;base64,{value}\2", html, count=1)
            if count != 1:
                raise SystemExit(f"SERAPH_HOLY_SPEAR_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(generated),
                          "size": Image.open(io.BytesIO(generated)).size},
                         separators=(",", ":")))
        return

    if args.build_minotaur_spear_projectile or args.install_minotaur_spear_projectile:
        if not args.minotaur_spear_projectile:
            parser.error("Копьё Минотавра требует --minotaur-spear-projectile")
        generated = minotaur_spear_projectile_sheet(args.minotaur_spear_projectile)
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "dread-minotaur-spear-projectile-4f-optimized.png"
        path.write_bytes(generated)
        if args.install_minotaur_spear_projectile:
            html = HTML.read_text(encoding="utf-8")
            value = base64.b64encode(generated).decode("ascii")
            html, count = re.subn(
                r"(const MINOTAUR_SPEAR_PROJECTILE_DATA = ')[^']*(';)",
                rf"\g<1>data:image/png;base64,{value}\2", html, count=1)
            if count != 1:
                raise SystemExit(f"MINOTAUR_SPEAR_PROJECTILE_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(generated),
                          "size": Image.open(io.BytesIO(generated)).size},
                         separators=(",", ":")))
        return

    if args.build_executioner_axe_projectile or args.install_executioner_axe_projectile:
        if not args.executioner_axe_projectile:
            parser.error("Вращающийся топор требует --executioner-axe-projectile")
        generated = executioner_axe_projectile_sheet(args.executioner_axe_projectile)
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "executioner-king-spinning-axe-8f-optimized.png"
        path.write_bytes(generated)
        if args.install_executioner_axe_projectile:
            html = HTML.read_text(encoding="utf-8")
            value = base64.b64encode(generated).decode("ascii")
            html, count = re.subn(
                r"(const EXECUTIONER_AXE_PROJECTILE_DATA = ')[^']*(';)",
                rf"\g<1>data:image/png;base64,{value}\2", html, count=1)
            if count != 1:
                raise SystemExit(f"EXECUTIONER_AXE_PROJECTILE_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(generated),
                          "size": Image.open(io.BytesIO(generated)).size},
                         separators=(",", ":")))
        return

    if args.build_greed_spear_projectile or args.install_greed_spear_projectile:
        if not args.greed_spear_projectile:
            parser.error("Копьё жадности требует --greed-spear-projectile")
        generated = greed_spear_projectile_sheet(args.greed_spear_projectile)
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "greed-brute-spear-projectile-4f-optimized.png"
        path.write_bytes(generated)
        if args.install_greed_spear_projectile:
            html = HTML.read_text(encoding="utf-8")
            value = base64.b64encode(generated).decode("ascii")
            html, count = re.subn(
                r"(const GREED_SPEAR_PROJECTILE_DATA = ')[^']*(';)",
                rf"\g<1>data:image/png;base64,{value}\2", html, count=1)
            if count != 1:
                raise SystemExit(f"GREED_SPEAR_PROJECTILE_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(generated),
                          "size": Image.open(io.BytesIO(generated)).size},
                         separators=(",", ":")))
        return

    if args.build_emerald_orb_projectile or args.install_emerald_orb_projectile:
        if not args.emerald_orb_projectile:
            parser.error("Изумрудная сфера требует --emerald-orb-projectile")
        generated = emerald_orb_projectile_sheet(args.emerald_orb_projectile)
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "emerald-lich-orb-projectile-4f-optimized.png"
        path.write_bytes(generated)
        if args.install_emerald_orb_projectile:
            html = HTML.read_text(encoding="utf-8")
            value = base64.b64encode(generated).decode("ascii")
            html, count = re.subn(
                r"(const EMERALD_ORB_PROJECTILE_DATA = ')[^']*(';)",
                rf"\g<1>data:image/png;base64,{value}\2", html, count=1)
            if count != 1:
                raise SystemExit(f"EMERALD_ORB_PROJECTILE_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(generated),
                          "size": Image.open(io.BytesIO(generated)).size},
                         separators=(",", ":")))
        return

    if args.build_plague_slime_projectile or args.install_plague_slime_projectile:
        if not args.plague_slime_projectile:
            parser.error("сгусток Чумной мерзости требует --plague-slime-projectile")
        generated = plague_slime_projectile_sheet(args.plague_slime_projectile)
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / "plague-abomination-slime-projectile-4f-optimized.png"
        path.write_bytes(generated)
        if args.install_plague_slime_projectile:
            html = HTML.read_text(encoding="utf-8")
            value = base64.b64encode(generated).decode("ascii")
            html, count = re.subn(
                r"(const PLAGUE_SLIME_PROJECTILE_DATA = ')[^']*(';)",
                rf"\g<1>data:image/png;base64,{value}\2", html, count=1)
            if count != 1:
                raise SystemExit(f"PLAGUE_SLIME_PROJECTILE_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({"path": str(path), "bytes": len(generated),
                          "size": Image.open(io.BytesIO(generated)).size},
                         separators=(",", ":")))
        return

    if args.build_mage_ability_assets or args.install_mage_ability_assets:
        sources = {
            "normal": (args.mage_explosion_normal, 6, False, 1.0),
            "remote": (args.mage_explosion_remote, 6, True, 1.0),
            "mini": (args.mage_explosion_mini, 6, False, 1.0),
            "residual": (args.mage_residual_arcana, 4, True, 1.0),
            # Цвет специально приглушён; умеренная прозрачность задаётся renderer-ом.
            "elemental": (args.mage_elemental_explosion, 8, False, 0.45),
            "heart": (args.mage_blast_heart, 4, True, 1.0),
        }
        missing = [key for key, (path, _, _, _) in sources.items() if not path]
        if missing:
            parser.error("листы взрывов Мага: отсутствуют " + ", ".join(missing))
        generated = {key: mage_ability_sheet(path, count, light, saturation)
                     for key, (path, count, light, saturation) in sources.items()}
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        paths = {key: output_dir / f"mage-{key}-explosion-optimized.png"
                 for key in generated}
        for key, path in paths.items():
            path.write_bytes(generated[key])
        if args.install_mage_ability_assets:
            html = HTML.read_text(encoding="utf-8")
            payload = {key: base64.b64encode(data).decode("ascii")
                       for key, data in generated.items()}
            body = "const MAGE_ABILITY_SPRITE_DATA = {\n" + "\n".join(
                f"  {key}:'data:image/png;base64,{value}',"
                for key, value in payload.items()) + "\n};"
            html, count = re.subn(r"const MAGE_ABILITY_SPRITE_DATA = \{.*?\n\};",
                                  body, html, flags=re.S)
            if count != 1:
                raise SystemExit(f"MAGE_ABILITY_SPRITE_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({key: {"path": str(paths[key]), "bytes": len(data),
                                "size": Image.open(io.BytesIO(data)).size}
                          for key, data in generated.items()}, separators=(",", ":")))
        return

    if args.build_minion_assets or args.install_minion_assets:
        sources = {
            "skeleton": (args.necro_skeleton, 24),
            "hunter": (args.necro_hunter, 24),
            "warlock": (args.necro_mage, 24),
            "golemB": (args.necro_blood_golem, 24),
            "golemN": (args.necro_bone_golem, 18),
        }
        missing = [key for key, (path, _) in sources.items() if not path]
        if missing:
            parser.error("листы свиты: отсутствуют " + ", ".join(missing))
        generated = {key: minion_sheet(path, size)
                     for key, (path, size) in sources.items()}
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        paths = {key: output_dir / f"necro-{key}-4f-optimized.png"
                 for key in generated}
        for key, path in paths.items():
            path.write_bytes(generated[key])
        if args.install_minion_assets:
            html = HTML.read_text(encoding="utf-8")
            payload = {key: base64.b64encode(data).decode("ascii")
                       for key, data in generated.items()}
            body = "const MINION_SPRITE_DATA = {\n" + "\n".join(
                f"  {key}:'data:image/png;base64,{value}',"
                for key, value in payload.items()) + "\n};"
            html, count = re.subn(r"const MINION_SPRITE_DATA = \{.*?\n\};",
                                  body, html, flags=re.S)
            if count != 1:
                raise SystemExit(f"MINION_SPRITE_DATA: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({key: {"path": str(paths[key]), "bytes": len(data),
                                "size": Image.open(io.BytesIO(data)).size}
                          for key, data in generated.items()}, separators=(",", ":")))
        return

    if args.build_arcane_mine_assets:
        if not args.arcane_mine or not args.arcane_mine_explosion:
            parser.error("--build-arcane-mine-assets требует оба ассета мины")
        generated = {
            "mine": arcane_mine_sprite(args.arcane_mine),
            "explosion": arcane_mine_explosion_sheet(args.arcane_mine_explosion),
        }
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        paths = {
            "mine": output_dir / "mage-arcane-mine-optimized.png",
            "explosion": output_dir / "mage-arcane-mine-explosion-8f-optimized.png",
        }
        for key, path in paths.items():
            path.write_bytes(generated[key])
        print(json.dumps({
            key: {"path": str(paths[key]), "bytes": len(data),
                  "size": Image.open(io.BytesIO(data)).size}
            for key, data in generated.items()
        }, separators=(",", ":")))
        return

    if args.build_menu_assets or args.install_menu_assets:
        if not args.menu_logo and not args.menu_torch and not args.menu_constellation_star:
            parser.error("ассеты меню требуют --menu-logo, --menu-torch и/или --menu-constellation-star")
        generated = {}
        if args.menu_logo:
            generated["logo"] = menu_logo_sheet(args.menu_logo)
        if args.menu_torch:
            generated["torch"] = menu_torch_sheet(args.menu_torch)
        if args.menu_constellation_star:
            generated["constellationStar"] = menu_constellation_star_sheet(args.menu_constellation_star)
        output_dir = ROOT / "outputs"
        output_dir.mkdir(exist_ok=True)
        paths = {
            "logo": output_dir / "grim-grind-title-spritesheet-optimized.png",
            "torch": output_dir / "grim-grind-torch-spritesheet-optimized.png",
            "constellationStar": output_dir / "constellation-menu-star-8f-optimized.png",
        }
        for key, data in generated.items():
            paths[key].write_bytes(data)
        if args.install_menu_assets:
            html = HTML.read_text(encoding="utf-8")
            js_names = {"logo": "GRIM_GRIND_LOGO_STRIP",
                        "torch": "GRIM_GRIND_TORCH_STRIP",
                        "constellationStar": "CONSTELLATION_STAR_STRIP"}
            for key in generated:
                js_name = js_names[key]
                pattern = rf"({js_name}\.src = 'data:image/png;base64,)[^']+(')"
                value = base64.b64encode(generated[key]).decode("ascii")
                html, count = re.subn(pattern, rf"\g<1>{value}\2", html, count=1)
                if count != 1:
                    raise SystemExit(f"{js_name}: ожидалась одна замена, получено {count}")
            HTML.write_text(html, encoding="utf-8", newline="\n")
        print(json.dumps({
            key: {"path": str(paths[key]), "bytes": len(data),
                  "size": Image.open(io.BytesIO(data)).size}
            for key, data in generated.items()
        }, separators=(",", ":")))
        return

    elite_sources = {
        "frostWolf": args.ice_wolf,
        "toxicRunner": args.toxic_runner,
        "cursedRogue": args.cursed_rogue,
        "skeletonWarrior": args.skeleton_warrior,
        "blightGrunt": args.blight_grunt,
        "boneGargoyle": args.bone_gargoyle,
    }
    if args.emit_elite_variant_base64 or args.install_elite_variants:
        missing = [key for key, path in elite_sources.items() if not path]
        if missing:
            parser.error("elite variants: отсутствуют " + ", ".join(missing))
        generated = {key: elite_variant_sheet(path) for key, path in elite_sources.items()}
        payload = {key: base64.b64encode(data).decode("ascii") for key, data in generated.items()}
        if args.emit_elite_variant_base64:
            print(json.dumps(payload, separators=(",", ":")))
            return
        html = HTML.read_text(encoding="utf-8")
        body = "const ELITE_SPRITE_DATA = {\n" + "\n".join(
            f"  {key}:'data:image/png;base64,{value}'," for key, value in payload.items()
        ) + "\n};"
        html, count = re.subn(r"const ELITE_SPRITE_DATA = \{.*?\n\};", body, html, flags=re.S)
        if count != 1:
            raise SystemExit(f"ELITE_SPRITE_DATA: ожидалась одна замена, получено {count}")
        HTML.write_text(html, encoding="utf-8")
        print(json.dumps({key: len(data) for key, data in generated.items()}, separators=(",", ":")))
        return

    ranged_tank_sources = {
        "fallenPyromancer": args.pyromancer_cultist,
        "beholderSlave": args.beholder_slave,
        "skeletonCrossbow": args.skeleton_crossbow,
        "forgottenGuard": args.forgotten_guard,
        "abyssalExecutioner": args.abyssal_warden,
        "plagueOgre": args.acid_carrier,
    }
    if args.emit_elite_ranged_tank_base64 or args.install_elite_ranged_tank:
        missing = [key for key, path in ranged_tank_sources.items() if not path]
        if missing:
            parser.error("elite ranged/tank: отсутствуют " + ", ".join(missing))
        generated = {key: elite_variant_sheet(path) for key, path in ranged_tank_sources.items()}
        payload = {key: base64.b64encode(data).decode("ascii") for key, data in generated.items()}
        if args.emit_elite_ranged_tank_base64:
            print(json.dumps(payload, separators=(",", ":")))
            return
        html = HTML.read_text(encoding="utf-8")
        html = install_object_payloads(html, "ELITE_SPRITE_DATA", payload)
        HTML.write_text(html, encoding="utf-8")
        print(json.dumps({key: len(data) for key, data in generated.items()}, separators=(",", ":")))
        return

    if args.emit_shooter_base64:
        if not args.shooter or not args.shooter_projectile:
            parser.error("--emit-shooter-base64 требует --shooter и --shooter-projectile")
        payload = {
            "shooter": base64.b64encode(shooter_sheet(args.shooter)).decode("ascii"),
            "shooterProjectile": base64.b64encode(
                shooter_projectile_sheet(args.shooter_projectile)).decode("ascii"),
        }
        print(json.dumps(payload, separators=(",", ":")))
        return

    if args.emit_player_projectile_base64:
        if not args.archer_projectile or not args.mage_projectile:
            parser.error("--emit-player-projectile-base64 требует --archer-projectile и --mage-projectile")
        payload = {
            "archerProjectile": base64.b64encode(
                archer_projectile(args.archer_projectile)).decode("ascii"),
            "mageProjectile": base64.b64encode(
                mage_projectile_sheet(args.mage_projectile)).decode("ascii"),
        }
        print(json.dumps(payload, separators=(",", ":")))
        return

    if args.emit_new_boss_base64:
        sources = {
            "vampire": args.vampire_boss,
            "voidwrath": args.void_wrath_boss,
            "minotaur": args.minotaur_boss,
            "seraph": args.seraph_boss,
            "matriarch": args.matriarch_boss,
            "demonqueen": args.demon_queen_boss,
        }
        missing = [key for key, path in sources.items() if not path]
        if missing:
            parser.error("--emit-new-boss-base64: отсутствуют " + ", ".join(missing))
        payload = {key: base64.b64encode(new_boss_sheet(path)).decode("ascii")
                   for key, path in sources.items()}
        print(json.dumps(payload, separators=(",", ":")))
        return

    if args.emit_constellation_base64:
        if not args.constellation_sheet:
            parser.error("--emit-constellation-base64 требует --constellation-sheet")
        payload = {key: base64.b64encode(data).decode("ascii")
                   for key, data in constellation_sheets(args.constellation_sheet).items()}
        print(json.dumps(payload, separators=(",", ":")))
        return

    if not all((args.archer, args.mage, args.warrior, args.necromancer)):
        parser.error("полный прогон требует --archer, --mage, --warrior и --necromancer")

    html = HTML.read_text(encoding="utf-8")
    original_size = len(html.encode("utf-8"))
    original_floor = uri_bytes(html, "FLOOR_TILE_DATA")

    hero_sources = {
        "archer": args.archer,
        "mage": args.mage,
        "warrior": args.warrior,
        "necromancer": args.necromancer,
    }
    generated: dict[str, bytes] = {key: hero_sheet(path) for key, path in hero_sources.items()}

    for key in ENEMY_FRAMES:
        source = Image.open(io.BytesIO(uri_bytes(html, key))).convert("RGBA")
        generated[key] = enemy_sheet(source, key)
    for key in ("lich", "goat", "plague", "greed", "executioner", "tyrant", "grave", "behemoth"):
        source = Image.open(io.BytesIO(uri_bytes(html, key))).convert("RGBA")
        generated[key] = boss_sheet(source)
    coin = Image.open(io.BytesIO(re.search(
        r"COIN_STRIP\.src = 'data:image/png;base64,([^']+)'", html
    ).group(1).encode() and base64.b64decode(re.search(
        r"COIN_STRIP\.src = 'data:image/png;base64,([^']+)'", html
    ).group(1)))).convert("RGBA")
    generated["COIN_STRIP"] = coin_sheet(coin)

    for key in ("archer", "mage", "warrior", "necromancer", "runner", "blob", "tank",
                "lich", "goat", "plague", "greed", "executioner", "tyrant", "grave", "behemoth"):
        html = replace_uri(html, key, generated[key])

    coin_b64 = base64.b64encode(generated["COIN_STRIP"]).decode("ascii")
    html, count = re.subn(
        r"(COIN_STRIP\.src = 'data:image/png;base64,)[^']+(')",
        rf"\g<1>{coin_b64}\2", html
    )
    if count != 1:
        raise SystemExit(f"Монеты: ожидалась одна замена, получено {count}")

    html = exact_replace(html,
        "/* Четырёхкадровые листы Бегуна, Ядра и Бастиона встроены ниже как data URI.\n"
        "   Исходные рисунки смотрят вправо;\n"
        "   как и герои, враги только зеркалятся по X и никогда не вращаются за целью.\n"
        "   Индивидуальные прямоугольники сохраняют длинные шаги Бегуна без растяжения\n"
        "   его коротких сгруппированных кадров. ax/ay — точка тела, стоящая на e.x/e.y. */",
        "/* Обычные враги упакованы в фиксированные кадры 40/48 px и палитру 16 цветов.\n"
        "   Все смотрят вправо и только зеркалятся по X; одинаковые прямоугольники кадров\n"
        "   уменьшают объём текстур, HTML и стоимость выбора области drawImage(). */",
        "комментарий обычных врагов")

    old_enemy_meta = """const ENEMY_SPRITE_META = {
  // Яркий Бегун намеренно компактнее остальных: 2.99 = прежние 4.6 * 0.65.
  // 20 px пути на кадр вместо 14 делают его быстрый цикл легче для глаза.
  runner:{src:ENEMY_SPRITE_DATA.runner, scale:2.99, stride:20, frames:[
    {x:20,  y:115,w:555,h:455,ax:374,ay:227}, {x:665, y:115,w:370,h:455,ax:178,ay:227},
    {x:1070,y:115,w:575,h:455,ax:337,ay:227}, {x:1755,y:115,w:370,h:455,ax:142,ay:227},
  ]},
  blob:{src:ENEMY_SPRITE_DATA.blob, scale:3.55, stride:18, frames:[
    {x:41,  y:170,w:398,h:490,ax:199,ay:245}, {x:491, y:170,w:415,h:490,ax:207,ay:245},
    {x:954, y:170,w:400,h:490,ax:200,ay:245}, {x:1411,y:170,w:418,h:490,ax:209,ay:245},
  ]},
  tank:{src:ENEMY_SPRITE_DATA.tank, scale:3.2, stride:18, frames:[
    {x:14,  y:216,w:396,h:470,ax:196,ay:234}, {x:448, y:216,w:377,h:470,ax:202,ay:234},
    {x:875, y:216,w:399,h:470,ax:200,ay:234}, {x:1319,y:216,w:378,h:470,ax:196,ay:234},
  ]},
};"""
    new_enemy_meta = """const ENEMY_SPRITE_META = {
  runner:{src:ENEMY_SPRITE_DATA.runner, scale:3.3333333333, stride:24, frames:[]},
  blob:  {src:ENEMY_SPRITE_DATA.blob,   scale:2.8571428571, stride:24, frames:[]},
  tank:  {src:ENEMY_SPRITE_DATA.tank,   scale:2.5263157895, stride:24, frames:[]},
};
for (const [key,meta] of Object.entries(ENEMY_SPRITE_META)){
  const size = key === 'tank' ? 48 : 40;
  for (let i=0;i<4;i++) meta.frames.push({x:i*size,y:0,w:size,h:size,ax:size/2,ay:size/2});
}"""
    html = exact_replace(html, old_enemy_meta, new_enemy_meta, "метаданные обычных врагов")

    html = exact_replace(html,
        "/* Четыре босса хранятся в том же автономном HTML. Исходные многомегабайтные\n"
        "   листы уменьшены до 512×192 и переведены в индексированную палитру: все четыре\n"
        "   вместе весят меньше 85 КБ до Base64. */",
        "/* Боссы хранятся в автономном HTML: четыре кадра 64×96 и 16 цветов.\n"
        "   Маленькая исходная текстура выводится крупно без сглаживания: экранный силуэт\n"
        "   не меньше 2.5 высоты героя, но видеопамять и Base64 остаются минимальными. */",
        "комментарий боссов")
    html = html.replace("scale:2.05, stride:20", "scale:2.5, stride:28")
    if html.count("scale:2.5, stride:28") != 8:
        raise SystemExit("Ожидалось восемь метаданных боссов")
    html = exact_replace(html,
        "for (let i = 0; i < 4; i++) meta.frames.push({x:i*128,y:0,w:128,h:192,ax:64,ay:145});",
        "for (let i = 0; i < 4; i++) meta.frames.push({x:i*64,y:0,w:64,h:96,ax:32,ay:72});",
        "кадры боссов")

    old_hero = """/* Новые листы: верхний ряд — четыре кадра ходьбы, нижний — четыре кадра действия.
   Для Лучника, Мага и Воина это атака, для Некроманта — призыв свиты. */
const HERO_SPRITE_META = {
  archer:{frameW:128,frameH:128,drawW:72,drawH:72},
  mage:{frameW:128,frameH:128,drawW:72,drawH:72},
  warrior:{frameW:128,frameH:128,drawW:72,drawH:72},
  necromancer:{frameW:128,frameH:128,drawW:72,drawH:72},
};"""
    new_hero = """/* Листы героев содержат только четыре кадра ходьбы 32×32: анимации атак
   и призыва удалены, потому что они создавали лишние кадры и визуальный шум. */
const HERO_SPRITE_META = {
  archer:{frameW:32,frameH:32,drawW:48,drawH:48},
  mage:{frameW:32,frameH:32,drawW:48,drawH:48},
  warrior:{frameW:32,frameH:32,drawW:48,drawH:48},
  necromancer:{frameW:32,frameH:32,drawW:48,drawH:48},
};"""
    html = exact_replace(html, old_hero, new_hero, "метаданные героев")
    html = exact_replace(html, ".hero-preview.sheet{background-position:0 0;background-size:400% 200%}",
                         ".hero-preview.sheet{background-position:0 0;background-size:400% 100%}",
                         "CSS превью героев")
    html = exact_replace(html,
        "    player:{x:0,y:0,vx:0,vy:0,r:13,hp:100,inv:0,dash:0,dashCd:0,dashN:0,\n"
        "            atkCd:0, aim:0, dashHits:[], leechPool:0, leechFlows:[], dreadShield:0, barrier:0, hitN:0, bladeN:0, guardianCd:0, berserkLow:false,\n"
        "            kills:0, reaper:false, trailT:0, bossSlowT:0, bossBurnT:0, bossBurnTick:0, bossBurnCause:'', bossTrailCd:0,\n"
        "            moveT:0, predT:0, critChain:0, riposte:false, swiftT:0, lowHp:false, moving:false, faceX:1, faceY:0, spriteFace:1,\n"
        "            heroWalkT:0, heroAttackT:0, heroAttackDur:0, heroSummonT:0, heroSummonDur:0,",
        "    player:{x:0,y:0,vx:0,vy:0,r:13,hp:100,inv:0,dash:0,dashCd:0,dashN:0,\n"
        "            atkCd:0, aim:0, dashHits:[], leechPool:0, leechFlows:[], dreadShield:0, barrier:0, hitN:0, bladeN:0, guardianCd:0, berserkLow:false,\n"
        "            kills:0, reaper:false, trailT:0, bossSlowT:0, bossBurnT:0, bossBurnTick:0, bossBurnCause:'', bossTrailCd:0,\n"
        "            moveT:0, predT:0, critChain:0, riposte:false, swiftT:0, lowHp:false, moving:false, faceX:1, faceY:0, spriteFace:1, heroWalkT:0,",
        "состояние анимации героя")
    html = exact_replace(html,
        "const MINION_LIFE_MIN = 10, MINION_LIFE_MAX = 15;\nfunction triggerHeroSummon(){\n  const p = G && G.player;\n  if (!p || G.weapon.id !== 'wpn.scythe' || p.heroSummonT > 0) return;\n  p.heroSummonDur = 0.48;\n  p.heroSummonT = p.heroSummonDur;\n}\n",
        "const MINION_LIFE_MIN = 10, MINION_LIFE_MAX = 15;\n",
        "таймер призыва героя")
    html = exact_replace(html, "  triggerHeroSummon();\n", "", "вызов анимации призыва")
    html = exact_replace(html,
        "  if (!src){\n    p.atkCd = D.atkCd;\n    /* Анимация должна читаться и на быстрых билдах: короткий минимум не даёт\n       четырём кадрам схлопнуться в один, повторный выстрел просто начинает цикл заново. */\n    p.heroAttackDur = Math.max(0.22, Math.min(0.42, D.atkCd * 0.75));\n    p.heroAttackT = p.heroAttackDur;\n  }",
        "  if (!src) p.atkCd = D.atkCd;",
        "таймер атаки героя")
    html = exact_replace(html,
        "  if (heroMoved > 0.01) p.heroWalkT = ((p.heroWalkT||0) + heroMoved/18) % 4;\n"
        "  p.heroAttackT = Math.max(0, (p.heroAttackT||0) - dt);\n"
        "  p.heroSummonT = Math.max(0, (p.heroSummonT||0) - dt);",
        "  // 36 единиц пути на кадр: походка читается спокойно и не дёргается.\n"
        "  if (heroMoved > 0.01) p.heroWalkT = ((p.heroWalkT||0) + heroMoved/36) % 4;",
        "скорость и таймеры анимации героя")
    old_draw = """    if (meta){
      const summoning = spriteKey === 'necromancer' && p.heroSummonT > 0;
      const attacking = spriteKey !== 'necromancer' && p.heroAttackT > 0;
      const acting = summoning || attacking;
      const actionT = summoning ? p.heroSummonT : p.heroAttackT;
      const actionDur = summoning ? p.heroSummonDur : p.heroAttackDur;
      const progress = acting ? 1 - actionT/Math.max(0.001, actionDur||0.3) : 0;
      const frame = acting ? Math.min(3, Math.floor(clamp(progress,0,0.9999)*4)) :
                    (p.moving ? Math.floor(p.heroWalkT||0)%4 : 0);
      ctx.drawImage(sprite, frame*meta.frameW, acting ? meta.frameH : 0,
        meta.frameW, meta.frameH, -meta.drawW/2, -meta.drawH/2, meta.drawW, meta.drawH);
    } else ctx.drawImage(sprite, -24, -24, 48, 48);"""
    new_draw = """    if (meta){
      const frame = p.moving ? Math.floor(p.heroWalkT||0)%4 : 0;
      ctx.drawImage(sprite, frame*meta.frameW, 0, meta.frameW, meta.frameH,
        -meta.drawW/2, -meta.drawH/2, meta.drawW, meta.drawH);
    } else ctx.drawImage(sprite, -24, -24, 48, 48);"""
    html = exact_replace(html, old_draw, new_draw, "рендер героя")

    html = exact_replace(html,
        "g.drawImage(COIN_STRIP, frame*24, 0, 24, 24, 0, 0, 48, 48);",
        "g.drawImage(COIN_STRIP, frame*8, 0, 8, 8, 0, 0, 48, 48);",
        "кадры монеты")
    html = exact_replace(html,
        "if (SHOP_COINS[i].c !== cv2 || cv2.width !== 48*d){\n      cv2.width = cv2.height = 48*d;",
        "if (SHOP_COINS[i].c !== cv2 || cv2.width !== 24*d){\n      cv2.width = cv2.height = 24*d;",
        "буфер монет")
    html = exact_replace(html,
        "g.clearRect(0,0,48,48); g.imageSmoothingEnabled = false;\n"
        "    g.drawImage(COIN_STRIP, frame*8, 0, 8, 8, 0, 0, 48, 48);",
        "g.clearRect(0,0,24,24); g.imageSmoothingEnabled = false;\n"
        "    g.drawImage(COIN_STRIP, frame*8, 0, 8, 8, 0, 0, 24, 24);",
        "отрисовка монет")
    html = exact_replace(html,
        "const g = cv3.getContext('2d'); g.clearRect(0,0,768,128); g.imageSmoothingEnabled = false;\n"
        "  g.drawImage(tiny, 0,0,192,32, 0,0,768,128);",
        "const g = cv3.getContext('2d'); g.clearRect(0,0,384,64); g.imageSmoothingEnabled = false;\n"
        "  g.drawImage(tiny, 0,0,192,32, 0,0,384,64);",
        "буфер заголовка")
    html = exact_replace(html,
        "'<div id=\"brand\"><canvas id=\"brandnm\" width=\"768\" height=\"128\"></canvas></div>';",
        "'<div id=\"brand\"><canvas id=\"brandnm\" width=\"384\" height=\"64\"></canvas></div>';",
        "canvas заголовка")
    html = exact_replace(html,
        "/* ---------- ЧАСТИЦЫ ----------\n"
        "   Мелкие квадратные пиксели, разлетающиеся из точки. Живут недолго,\n"
        "   тормозят трением и гаснут. Потолок в 700 штук держит кадр стабильным. */\n"
        "function burst(x, y, n, col, spd, size, life){\n"
        "  if (G.parts.length > 700) n = Math.min(n, 4);",
        "/* ---------- ЧАСТИЦЫ ----------\n"
        "   Декоративный поток намеренно прорежен вдвое и ограничен 300 объектами:\n"
        "   качество эффектов уступает стабильному кадру в большой толпе. */\n"
        "function burst(x, y, n, col, spd, size, life){\n"
        "  n = Math.max(1, Math.ceil(n*0.5));\n"
        "  if (G.parts.length > 300) n = Math.min(n, 2);",
        "потолок частиц")
    html = exact_replace(html,
        "    const K = MKIND[m.kind], golem = m.kind.startsWith('golem');",
        "    const K = MKIND[m.kind], golem = m.kind.startsWith('golem');\n"
        "    // Хитбокс механики остаётся m.r, но обычный приспешник рисуется 12×12.\n"
        "    const visualR = golem ? (m.kind === 'golemB' ? 12 : 9) : 6;",
        "визуальный размер свиты")
    html = exact_replace(html,
        "drawPoly(m.x, m.y, m.r, K.sides, m.rot); ctx.fill(); ctx.stroke();",
        "drawPoly(m.x, m.y, visualR, K.sides, m.rot); ctx.fill(); ctx.stroke();",
        "рендер свиты")
    html = exact_replace(html, "ctx.arc(m.x, m.y, m.r + 5, 0, 6.29)",
                         "ctx.arc(m.x, m.y, visualR + 4, 0, 6.29)", "ореол свиты")
    html = exact_replace(html,
        "      const w = m.r*2;\n"
        "      ctx.fillStyle = '#000a'; ctx.fillRect(m.x-w/2, m.y-m.r-7, w, 2);\n"
        "      ctx.fillStyle = K.col;   ctx.fillRect(m.x-w/2, m.y-m.r-7, w*clamp(m.hp/m.max,0,1), 2);",
        "      const w = visualR*2;\n"
        "      ctx.fillStyle = '#000a'; ctx.fillRect(m.x-w/2, m.y-visualR-7, w, 2);\n"
        "      ctx.fillStyle = K.col;   ctx.fillRect(m.x-w/2, m.y-visualR-7, w*clamp(m.hp/m.max,0,1), 2);",
        "полоса здоровья свиты")

    if uri_bytes(html, "FLOOR_TILE_DATA") != original_floor:
        raise SystemExit("Пол изменился, хотя исключён из оптимизации")
    HTML.write_text(html, encoding="utf-8", newline="\n")
    final_size = len(html.encode("utf-8"))
    print(f"HTML: {original_size} -> {final_size} bytes ({final_size/original_size:.1%})")
    for key, png in generated.items():
        image = Image.open(io.BytesIO(png))
        print(f"{key:13} {image.width}x{image.height} {len(png)} bytes mode={image.mode}")


if __name__ == "__main__":
    main()
