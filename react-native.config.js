module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath: 'import com.daily.reactlibrary.DailyCallClientPackage;',
        packageInstance: 'new DailyCallClientPackage()',
      },
      ios: {},
    },
  },
};
