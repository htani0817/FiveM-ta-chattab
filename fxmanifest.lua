fx_version 'cerulean'
game 'gta5'

name 'ta-chattab'
description 'Complete chat commands with the Tab key'
author 'Tani'
version '2.0.0'

files {
    'html/tab.js'
}

-- chat（FXServer 同梱）のテーマの仕組みで、チャット画面に tab.js を読み込ませる。
-- chat 本体も qbx_chat_theme も書き換えない。見た目は変えないので styleSheet は無し
chat_theme 'ta_chattab' {
    script = 'html/tab.js'
}

dependency 'chat'
