{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-23.11"; 

  # 1. ADD PACKAGES HERE
  packages = [
    pkgs.jdk17        # Essential for Android builds
    pkgs.unzip        # Required for Gradle
    pkgs.firebase-tools # Useful for your Firebase app
  ];

  # 2. SET ENVIRONMENT VARIABLES HERE
  env = {
    # This manually fixes the "Java home not set" error
    JAVA_HOME = "${pkgs.jdk17}/lib/openjdk";
  };

  idx = {
    # 3. ENABLE PREVIEWS (EMULATOR)
    previews = {
      enable = true;
      previews = {
        android = {
          # This command builds and runs the app on the emulator
          command = [ "./gradlew" "assembleDebug" ]; 
          manager = "android";
        };
      };
    };
  };
}