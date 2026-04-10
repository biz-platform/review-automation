-- tone_settings: Zod(tone-settings-dto.ts) 와 동일 허용값을 DB에서 강제

ALTER TABLE tone_settings DROP CONSTRAINT IF EXISTS tone_settings_tone_check;
ALTER TABLE tone_settings ADD CONSTRAINT tone_settings_tone_check
  CHECK (
    tone = ANY (
      ARRAY[
        'default',
        'female_2030',
        'male_2030',
        'senior_4050',
        'friendly',
        'formal',
        'casual'
      ]::text[]
    )
  );

ALTER TABLE tone_settings DROP CONSTRAINT IF EXISTS tone_settings_comment_length_check;
ALTER TABLE tone_settings ADD CONSTRAINT tone_settings_comment_length_check
  CHECK (comment_length = ANY (ARRAY['short', 'normal', 'long']::text[]));

ALTER TABLE tone_settings DROP CONSTRAINT IF EXISTS tone_settings_comment_register_mode_check;
ALTER TABLE tone_settings ADD CONSTRAINT tone_settings_comment_register_mode_check
  CHECK (comment_register_mode = ANY (ARRAY['direct', 'auto']::text[]));

ALTER TABLE tone_settings DROP CONSTRAINT IF EXISTS tone_settings_auto_register_scheduled_hour_check;
ALTER TABLE tone_settings ADD CONSTRAINT tone_settings_auto_register_scheduled_hour_check
  CHECK (
    auto_register_scheduled_hour IS NULL
    OR (auto_register_scheduled_hour >= 0 AND auto_register_scheduled_hour <= 23)
  );
