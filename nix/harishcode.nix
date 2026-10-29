{
  lib,
  stdenvNoCC,
  callPackage,
  bun,
  nodejs,
  sysctl,
  makeBinaryWrapper,
  models-dev,
  ripgrep,
  wayland,
  installShellFiles,
  versionCheckHook,
  writableTmpDirAsHomeHook,
  node_modules ? callPackage ./node_modules.nix { },
}:
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "harishcode";
  inherit (node_modules) version src;
  inherit node_modules;

  nativeBuildInputs = [
    bun
    nodejs # for patchShebangs node_modules
    installShellFiles
    makeBinaryWrapper
    models-dev
    writableTmpDirAsHomeHook
  ];

  postPatch = ''
    # NOTE: Relax Bun version check to be a warning instead of an error
    substituteInPlace packages/script/src/index.ts \
      --replace-fail 'throw new Error(`This script requires bun@''${expectedBunVersionRange}' \
                     'console.warn(`Warning: This script requires bun@''${expectedBunVersionRange}'
  '';

  configurePhase = ''
    runHook preConfigure

    cp -R ${finalAttrs.node_modules}/. .
    patchShebangs node_modules
    patchShebangs packages/*/node_modules

    runHook postConfigure
  '';

  env.MODELS_DEV_API_JSON = "${models-dev}/dist/_api.json";
  env.HARISHCODE_DISABLE_MODELS_FETCH = true;
  env.HARISHCODE_VERSION = finalAttrs.version;
  env.HARISHCODE_CHANNEL = "prod";
  env.NODE_OPTIONS = "--max-old-space-size=4096";

  buildPhase = ''
    runHook preBuild

    cd ./packages/cli
    bun --bun ./script/build.ts --single --skip-install

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    install -Dm755 dist/cli-*/bin/harishcode $out/bin/harishcode

    # OpenTUI dlopens Wayland for clipboard images.
    wrapProgram $out/bin/harishcode \
      --prefix PATH : ${
        lib.makeBinPath (
          [
            ripgrep
          ]
          # bun runs sysctl to detect if running on rosetta2
          ++ lib.optional stdenvNoCC.hostPlatform.isDarwin sysctl
        )
      } ${lib.optionalString stdenvNoCC.hostPlatform.isLinux ''
        --prefix LD_LIBRARY_PATH : ${lib.makeLibraryPath [ wayland ]}
      ''}

    ln -s harishcode $out/bin/harishcode2

    runHook postInstall
  '';

  postInstall = lib.optionalString (stdenvNoCC.buildPlatform.canExecute stdenvNoCC.hostPlatform) ''
    # v2 dropped the `completion` subcommand; --completions is the global flag.
    # --completions also accepts sh, which emits the same script as bash.
    # staged to files, substitute below rejects anything that is not a regular file
    $out/bin/harishcode --completions bash > harishcode.bash
    $out/bin/harishcode --completions zsh > _harishcode
    $out/bin/harishcode --completions fish > harishcode.fish

    installShellCompletion --cmd harishcode \
      --bash harishcode.bash \
      --fish harishcode.fish \
      --zsh _harishcode

    # HARISHCODE_CLI_NAME is a build-time define, so the harishcode2 copies are
    # renamed rather than regenerated. --replace-fail is a global literal
    # substitution, so any lowercase harishcode that later appears in a
    # description or help text ships as harishcode2 in the harishcode2 copy.
    substitute harishcode.bash harishcode2.bash --replace-fail harishcode harishcode2
    substitute _harishcode _harishcode2 --replace-fail harishcode harishcode2
    substitute harishcode.fish harishcode2.fish --replace-fail harishcode harishcode2

    installShellCompletion --cmd harishcode2 \
      --bash harishcode2.bash \
      --fish harishcode2.fish \
      --zsh _harishcode2
  '';

  nativeInstallCheckInputs = [
    versionCheckHook
    writableTmpDirAsHomeHook
  ];
  doInstallCheck = true;
  versionCheckKeepEnvironment = [ "HOME" "HARISHCODE_DISABLE_MODELS_FETCH" ];
  versionCheckProgramArg = "--version";

  passthru = {
    env = finalAttrs.env;
  };

  meta = {
    description = "The open source coding agent";
    homepage = "https://harishcode.ai";
    license = lib.licenses.mit;
    mainProgram = "harishcode";
    inherit (node_modules.meta) platforms;
  };
})
