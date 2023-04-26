const selectFolder = async (type) => {
    return await window.api.openDirectory(type);
}

const selectFile = async (type) => {
    return await window.api.openFile(type);
}

const openFolder = async (dest) => {
    return await window.api.openFolder(dest);
}

const reloadSetting = async () => {
    return await window.api.reloadSetting();
}

const generateFullReport = async (option) => {
    await window.api.generateFullReport(option)
    callback();
}

const generateReportSummary = (dest, option) => {
    window.api.generateReportSummary(dest, option)
    callback();
}

const generateReportAudit = (option) => {
    window.api.generateReportAudit(option)
    callback();
}

const getSamplePath = (option) => {
    window.api.getSamplePath(option)
    callback();
}