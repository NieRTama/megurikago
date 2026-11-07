Pod::Spec.new do |s|
  s.name           = 'MegurikagoNative'
  s.version        = '1.0.0'
  s.summary        = 'Subject lift (Vision) and widget data bridge for Megurikago'
  s.description    = 'Subject lift (Vision) and widget data bridge for Megurikago'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
