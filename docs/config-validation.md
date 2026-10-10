# 設定ファイルの入力検証

[config.md](config.md)から参照される。設定値の制約を確認する際に参照する。

設定ファイルには表にあるキーだけを指定できる。配列項目は各要素が空でない文字列であればよく、
配列自体は空でもよい。
`maxDocBytes`・`minDuplicateChars` は正の整数、`checkDuplicates`・
`checkNearDuplicates` は真偽値にする。ディレクトリ・ファイルの設定値は
リポジトリ内の相対パスとし、絶対パスや `..` による親ディレクトリ参照は
指定できない。`tighten` と `dedupe` は `mode` だけを持つオブジェクトとし、
`mode` は `safe` または `auto` にする。`extensions` は `.md` のような拡張子の、空でない配列にする。不正なJSONや型は検査開始時にエラーとして報告する。
