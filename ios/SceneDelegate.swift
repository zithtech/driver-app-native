import UIKit
import React

@available(iOS 13.0, *)
@objc(SceneDelegate)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    guard let windowScene = (scene as? UIWindowScene) else { return }
    let delegate = UIApplication.shared.delegate as! AppDelegate
    
    // Create a BRAND NEW window for the Scene
    let newWindow = UIWindow(windowScene: windowScene)
    
    // Transfer the React Native rootViewController from AppDelegate's hidden window
    // Transfer React Native rootViewController from AppDelegate
    if let rnRootVC = delegate.window.rootViewController {
        newWindow.rootViewController = rnRootVC
    } else {
        let emptyVC = UIViewController()
        emptyVC.view.backgroundColor = .white
        newWindow.rootViewController = emptyVC
    }
    self.window = newWindow
    delegate.window = newWindow // VERY IMPORTANT for React Native modal/dialogs!
    
    newWindow.makeKeyAndVisible()
  }
}
