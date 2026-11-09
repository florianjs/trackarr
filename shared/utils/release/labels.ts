/**
 * Words of the generated description, per language. Not in i18n/locales: the
 * CLI renders descriptions too, without the app's i18n. Typed so every
 * language has every key.
 */

export const DESCRIPTION_LANGUAGES = ['en', 'fr', 'es', 'de', 'it', 'zh', 'ja', 'ru'] as const;
export type DescriptionLanguage = (typeof DESCRIPTION_LANGUAGES)[number];

export interface DescriptionLabels {
  release: string;
  source: string;
  group: string;
  season: string;
  episode: string;
  video: string;
  audio: string;
  subtitles: string;
  general: string;
  container: string;
  duration: string;
  size: string;
  bitrate: string;
  bits: string;
  forced: string;
  screenshots: string;
  files: string;
  notes: string;
  hours: string;
  minutes: string;
  units: [string, string, string, string, string];
}

const EN_UNITS: DescriptionLabels['units'] = ['B', 'KB', 'MB', 'GB', 'TB'];

export const DESCRIPTION_LABELS: Record<DescriptionLanguage, DescriptionLabels> = {
  en: {
    release: 'Release', source: 'Source', group: 'Group', season: 'Season', episode: 'Episode',
    video: 'Video', audio: 'Audio', subtitles: 'Subtitles', general: 'General',
    container: 'Container', duration: 'Duration', size: 'Size', bitrate: 'Bitrate', bits: 'bits',
    forced: 'forced', screenshots: 'Screenshots', files: 'Files', notes: 'Notes',
    hours: 'h', minutes: 'min', units: EN_UNITS,
  },
  fr: {
    release: 'Release', source: 'Source', group: 'Team', season: 'Saison', episode: 'Épisode',
    video: 'Vidéo', audio: 'Audio', subtitles: 'Sous-titres', general: 'Général',
    container: 'Conteneur', duration: 'Durée', size: 'Taille', bitrate: 'Débit', bits: 'bits',
    forced: 'forcés', screenshots: 'Captures', files: 'Fichiers', notes: 'Notes',
    hours: 'h', minutes: 'min', units: ['o', 'Ko', 'Mo', 'Go', 'To'],
  },
  es: {
    release: 'Release', source: 'Fuente', group: 'Grupo', season: 'Temporada', episode: 'Episodio',
    video: 'Vídeo', audio: 'Audio', subtitles: 'Subtítulos', general: 'General',
    container: 'Contenedor', duration: 'Duración', size: 'Tamaño', bitrate: 'Tasa de bits', bits: 'bits',
    forced: 'forzados', screenshots: 'Capturas', files: 'Archivos', notes: 'Notas',
    hours: 'h', minutes: 'min', units: EN_UNITS,
  },
  de: {
    release: 'Release', source: 'Quelle', group: 'Gruppe', season: 'Staffel', episode: 'Folge',
    video: 'Video', audio: 'Audio', subtitles: 'Untertitel', general: 'Allgemein',
    container: 'Container', duration: 'Laufzeit', size: 'Größe', bitrate: 'Bitrate', bits: 'Bit',
    forced: 'erzwungen', screenshots: 'Screenshots', files: 'Dateien', notes: 'Hinweise',
    hours: 'Std.', minutes: 'Min.', units: EN_UNITS,
  },
  it: {
    release: 'Release', source: 'Sorgente', group: 'Gruppo', season: 'Stagione', episode: 'Episodio',
    video: 'Video', audio: 'Audio', subtitles: 'Sottotitoli', general: 'Generale',
    container: 'Contenitore', duration: 'Durata', size: 'Dimensione', bitrate: 'Bitrate', bits: 'bit',
    forced: 'forzati', screenshots: 'Screenshot', files: 'File', notes: 'Note',
    hours: 'h', minutes: 'min', units: EN_UNITS,
  },
  zh: {
    release: '发布', source: '来源', group: '小组', season: '季', episode: '集',
    video: '视频', audio: '音频', subtitles: '字幕', general: '概要',
    container: '容器', duration: '时长', size: '大小', bitrate: '码率', bits: '位',
    forced: '强制', screenshots: '截图', files: '文件', notes: '备注',
    hours: '小时', minutes: '分钟', units: EN_UNITS,
  },
  ja: {
    release: 'リリース', source: 'ソース', group: 'グループ', season: 'シーズン', episode: 'エピソード',
    video: '映像', audio: '音声', subtitles: '字幕', general: '概要',
    container: 'コンテナ', duration: '再生時間', size: 'サイズ', bitrate: 'ビットレート', bits: 'ビット',
    forced: '強制', screenshots: 'スクリーンショット', files: 'ファイル', notes: '備考',
    hours: '時間', minutes: '分', units: EN_UNITS,
  },
  ru: {
    release: 'Релиз', source: 'Источник', group: 'Группа', season: 'Сезон', episode: 'Серия',
    video: 'Видео', audio: 'Аудио', subtitles: 'Субтитры', general: 'Общее',
    container: 'Контейнер', duration: 'Длительность', size: 'Размер', bitrate: 'Битрейт', bits: 'бит',
    forced: 'форсированные', screenshots: 'Скриншоты', files: 'Файлы', notes: 'Примечания',
    hours: 'ч', minutes: 'мин', units: ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'],
  },
};

export function isDescriptionLanguage(value: unknown): value is DescriptionLanguage {
  return typeof value === 'string' && (DESCRIPTION_LANGUAGES as readonly string[]).includes(value);
}
