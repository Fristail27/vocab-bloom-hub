export enum ErrorCodes {
  login_or_pass_wrong = 'login_or_pass_wrong',
  invalid_token = 'invalid_token',
  internal_server_error = 'Internal server error',
  unparsed_data = 'unparsed_data',
  failed_fetch = 'failed_fetch',
  word_already_exists = 'word_already_exists',
  phrasal_base_doesnt_exist = 'phrasal_base_doesnt_exist',
  word_doesnt_found = 'word_doesnt_found',
  synonym_doesnt_exist = 'synonym_doesnt_exist',
  antonym_doesnt_exist = 'antonym_doesnt_exist',
  synonym_antonym_conflict = 'synonym_antonym_conflict',
  dataset_manifest_not_found = 'dataset_manifest_not_found',
  // local dataset sources (issue #269)
  import_dir_not_configured = 'import_dir_not_configured',
  dataset_file_not_found = 'dataset_file_not_found',
  dataset_invalid = 'dataset_invalid',
  dataset_upload_missing = 'dataset_upload_missing',
  // one import at a time (issue #268)
  import_in_progress = 'import_in_progress',
  translation_doesnt_found = 'translation_doesnt_found',
  setting_field_doesnt_found = 'setting_field_doesnt_found',
  setting_field_already_exists = 'setting_field_already_exists',
  unknown_error = 'unknown_error',
  too_many_requests = 'too_many_requests',
  // reader feedback on the dictionary data (issue #327)
  suggestion_doesnt_found = 'suggestion_doesnt_found',
  suggestion_queue_full = 'suggestion_queue_full',
  // the proposed changes are malformed: unknown field, wrong type, nothing changed
  suggestion_invalid = 'suggestion_invalid',
  // apply on a report, or on a suggestion that already took a verdict
  suggestion_not_applicable = 'suggestion_not_applicable',
  // public list paging (issue #272)
  invalid_cursor = 'invalid_cursor',
  // the public OpenAPI document was not attached to the application (issue #273)
  openapi_not_available = 'openapi_not_available',
}
