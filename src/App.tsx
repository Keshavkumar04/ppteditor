import { PresentationEditor } from './components/PresentationEditor'

function App() {
  return (
    <PresentationEditor
      initialData={null}
      onChange={(data) => console.log('Changed:', data.name)}
      onSave={(data) => {
        localStorage.setItem('ppteditor_dev', JSON.stringify(data))
        console.log('Saved:', data.name)
      }}
      style={{ height: '100vh' }}
    />
  )
}

export default App
